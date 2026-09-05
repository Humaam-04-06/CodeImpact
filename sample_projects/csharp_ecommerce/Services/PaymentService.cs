using System;
using System.Threading.Tasks;

namespace ECommerce.Services
{
    public class PaymentService
    {
        private readonly OrderService _orderService;

        public PaymentService(OrderService orderService)
        {
            _orderService = orderService;
        }

        public async Task<PaymentReceipt> ProcessPayment(string userId, decimal amount, string paymentMethod)
        {
            // Cascade caller: PaymentService calls OrderService.CreateOrder -> calls UserService.GetUser
            var order = await _orderService.CreateOrder(userId, amount);
            if (!order.Success)
            {
                return new PaymentReceipt { Status = "Failed", Error = order.Reason };
            }

            return new PaymentReceipt
            {
                Status = "Authorized",
                TransactionId = "TXN_" + Guid.NewGuid().ToString().Substring(0, 8)
            };
        }
    }

    public class PaymentReceipt
    {
        public string Status { get; set; }
        public string TransactionId { get; set; }
        public string Error { get; set; }
    }
}
