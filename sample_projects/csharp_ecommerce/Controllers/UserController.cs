using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using ECommerce.Services;

namespace ECommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly UserService _userService;

        public UserController(UserService userService)
        {
            _userService = userService;
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetProfile(string id)
        {
            // Controller 3: Calls UserService.GetUser
            var user = await _userService.GetUser(id);
            if (user == null)
            {
                return NotFound();
            }
            return Ok(user);
        }
    }
}
