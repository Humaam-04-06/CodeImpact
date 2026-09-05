using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using ECommerce.Services;

namespace ECommerce.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrderController : ControllerBase
    {
        private readonly OrderService _orderService;

        public OrderController(OrderService orderService)
        {
            _orderService = orderService;
        }

        [HttpPost("checkout")]
        public async Task<IActionResult> Checkout([FromBody] CheckoutRequest request)
        {
            // Controller 2: Calls OrderService.CreateOrder -> calls UserService.GetUser
            var result = await _orderService.CreateOrder(request.UserId, request.Amount);
            if (!result.Success)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }
    }

    public class CheckoutRequest
    {
        public string UserId { get; set; }
        public decimal Amount { get; set; }
    }
}
