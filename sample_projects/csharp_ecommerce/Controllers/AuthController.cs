using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using ECommerce.Services;

namespace ECommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserService _userService;

        public AuthController(UserService userService)
        {
            _userService = userService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            // Controller 1: Directly calls UserService.GetUser
            var user = await _userService.GetUser(request.UserId);
            if (user == null)
            {
                return Unauthorized(new { message = "Invalid credentials" });
            }

            return Ok(new { token = "jwt_token_demo", name = user.Name });
        }
    }

    public class LoginRequest
    {
        public string UserId { get; set; }
        public string Password { get; set; }
    }
}
