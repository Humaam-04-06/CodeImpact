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
    
    function visit(node, currentClass = '') {
        if (ts.isClassDeclaration(node) && node.name) {
            const clsName = node.name.text;
            ts.forEachChild(node, child => visit(child, clsName));
            return;
        }
        
        let fnName = '';
        let parameters = [];
        if (ts.isFunctionDeclaration(node) && node.name) {
            fnName = node.name.text;
            if (node.parameters) {
                parameters = node.parameters.map(p => ({
                    name: p.name.getText(sf),
                    type_annotation: p.type ? p.type.getText(sf) : null
                }));
            }
        } else if (ts.isMethodDeclaration(node) && node.name) {
            fnName = node.name.getText(sf);
            if (node.parameters) {
                parameters = node.parameters.map(p => ({
                    name: p.name.getText(sf),
                    type_annotation: p.type ? p.type.getText(sf) : null
                }));
            }
        }
        
        if (fnName) {
            const start = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            const end = sf.getLineAndCharacterOfPosition(node.getEnd());
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
            ts.forEachChild(node, visitCalls);
            
            const startRow = start.line;
            const endRow = end.line;
            const sourceSlice = lines.slice(startRow, endRow + 1).join('\n');
            
            symbols.push({
                id: symbolId,
                name: fnName,
                full_name: symbolId,
                class_name: currentClass || null,
                line_number: startRow + 1,
                end_line_number: endRow + 1,
                parameters: parameters,
                calls: fnCalls,
                source_code: sourceSlice
            });
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
