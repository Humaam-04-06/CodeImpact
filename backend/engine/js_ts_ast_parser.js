const fs = require('fs');
const path = require('path');

let ts;
try {
    ts = require(path.resolve(__dirname, '../../frontend/node_modules/typescript'));
} catch (e) {
    try {
        ts = require('typescript');
    } catch (e2) {
        process.stderr.write("TypeScript compiler module not found\n");
        process.exit(1);
    }
}

function parseJsTsContent(code, filePath) {
    const sf = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
    const symbols = [];
    const lines = code.split(/\r?\n/);
    
    function registerFunction(fnName, paramList, returnType, outerNode, bodyNode, currentClass) {
        const start = sf.getLineAndCharacterOfPosition(outerNode.getStart(sf));
        const end = sf.getLineAndCharacterOfPosition(outerNode.getEnd());
        const fnCalls = [];
        const symbolId = currentClass ? `${currentClass}.${fnName}` : fnName;
        
        function visitCalls(inner) {
            if (ts.isCallExpression(inner)) {
                let target = '';
                const expr = inner.expression;
                if (ts.isIdentifier(expr)) {
                    target = expr.text;
                } else if (ts.isPropertyAccessExpression(expr)) {
                    target = expr.name.text;
                }
                if (target && !['log', 'error', 'warn', 'then', 'catch'].includes(target)) {
                    const callLine = sf.getLineAndCharacterOfPosition(inner.getStart(sf));
                    fnCalls.push({
                        target_name: target,
                        line_number: callLine.line + 1,
                        arguments_count: inner.arguments ? inner.arguments.length : 0,
                        raw_call: inner.getText(sf).slice(0, 60),
                        caller_id: symbolId
                    });
                }
            }
            ts.forEachChild(inner, visitCalls);
        }
        ts.forEachChild(bodyNode, visitCalls);
        
        const startRow = start.line;
        const endRow = end.line;
        const sourceSlice = lines.slice(startRow, endRow + 1).join('\n');
        
        symbols.push({
            id: symbolId,
            name: fnName,
            full_name: symbolId,
            class_name: currentClass || null,
            return_type: returnType || null,
            line_number: startRow + 1,
            end_line_number: endRow + 1,
            parameters: paramList,
            calls: fnCalls,
            source_code: sourceSlice
        });
    }

    function visit(node, currentClass = '') {
        if (ts.isClassDeclaration(node) && node.name) {
            const clsName = node.name.text;
            ts.forEachChild(node, child => visit(child, clsName));
            return;
        }
        
        if (ts.isFunctionDeclaration(node) && node.name) {
            const fnName = node.name.text;
            const params = (node.parameters || []).map(p => ({
                name: p.name.getText(sf),
                type_annotation: p.type ? p.type.getText(sf) : null
            }));
            const returnType = node.type ? node.type.getText(sf) : null;
            registerFunction(fnName, params, returnType, node, node, currentClass);
            return;
        }
        
        if (ts.isMethodDeclaration(node) && node.name) {
            const fnName = node.name.getText(sf);
            const params = (node.parameters || []).map(p => ({
                name: p.name.getText(sf),
                type_annotation: p.type ? p.type.getText(sf) : null
            }));
            const returnType = node.type ? node.type.getText(sf) : null;
            registerFunction(fnName, params, returnType, node, node, currentClass);
            return;
        }

        if (ts.isPropertyDeclaration(node) && node.name && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
            const fnName = node.name.getText(sf);
            const fn = node.initializer;
            const params = (fn.parameters || []).map(p => ({
                name: p.name.getText(sf),
                type_annotation: p.type ? p.type.getText(sf) : null
            }));
            const returnType = fn.type ? fn.type.getText(sf) : (node.type ? node.type.getText(sf) : null);
            registerFunction(fnName, params, returnType, node, fn, currentClass);
            return;
        }

        if (ts.isVariableStatement(node)) {
            for (const decl of node.declarationList.declarations) {
                if (decl.name && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
                    const fnName = decl.name.getText(sf);
                    const fn = decl.initializer;
                    const params = (fn.parameters || []).map(p => ({
                        name: p.name.getText(sf),
                        type_annotation: p.type ? p.type.getText(sf) : null
                    }));
                    const returnType = fn.type ? fn.type.getText(sf) : (decl.type ? decl.type.getText(sf) : null);
                    registerFunction(fnName, params, returnType, decl, fn, currentClass);
                }
            }
            return;
        }

        ts.forEachChild(node, child => visit(child, currentClass));
    }
    
    visit(sf);
    return symbols;
}

function parseJsTsFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    return parseJsTsContent(code, filePath);
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        process.stderr.write("Usage: node js_ts_ast_parser.js <file_path> OR --batch <manifest_file>\n");
        process.exit(1);
    }
    
    try {
        if (args[0] === '--batch' && args[1]) {
            const manifest = JSON.parse(fs.readFileSync(args[1], 'utf8'));
            const results = {};
            for (const item of manifest) {
                // item: { filePath: string, relPath: string }
                try {
                    results[item.relPath] = parseJsTsFile(item.filePath);
                } catch (e) {
                    results[item.relPath] = [];
                }
            }
            process.stdout.write(JSON.stringify(results));
        } else {
            const results = parseJsTsFile(args[0]);
            process.stdout.write(JSON.stringify(results));
        }
    } catch (err) {
        process.stderr.write(err.message + "\n");
        process.exit(1);
    }
}

module.exports = { parseJsTsContent, parseJsTsFile };
