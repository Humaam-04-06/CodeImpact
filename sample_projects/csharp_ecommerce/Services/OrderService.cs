using System;
using System.Threading.Tasks;

namespace ECommerce.Services
{
    public class OrderService
    {
        private readonly UserService _userService;

        public OrderService(UserService userService)
        {
            _userService = userService;
        }

        public async Task<OrderResult> CreateOrder(string userId, decimal amount)
        {
            // Upstream dependent caller 1: OrderService calls UserService.GetUser
            var user = await _userService.GetUser(userId);
            if (user == null || user.Status != "Active")
            {
                return new OrderResult { Success = false, Reason = "User inactive or not found" };
            }

            return new OrderResult { Success = true, OrderId = Guid.NewGuid().ToString() };
        }

        public async Task<OrderSummary> GetUserOrderHistory(string userId)
        {
            // Upstream dependent caller 2: Order history validation
            var user = await _userService.GetUser(userId);
            return new OrderSummary { UserId = user.Id, TotalOrders = 5 };
        }
    }

    public class OrderResult
    {
        public bool Success { get; set; }
        public string OrderId { get; set; }
        public string Reason { get; set; }
    }

    public class OrderSummary
    {
        public string UserId { get; set; }
        public int TotalOrders { get; set; }
    }
}
