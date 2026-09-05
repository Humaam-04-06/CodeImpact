using System;
using System.Threading.Tasks;
using ECommerce.Repositories;

namespace ECommerce.Services
{
    public class UserService
    {
        private readonly UserRepository _userRepository;

        public UserService(UserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        /// <summary>
        /// Core User Retrieval Function.
        /// Changes to this signature or return contract ripple across OrderService, PaymentService, AuthController, etc.
        /// </summary>
        public async Task<UserRecord> GetUser(string userId)
        {
            if (string.IsNullOrEmpty(userId))
            {
                throw new ArgumentException("User ID cannot be empty", nameof(userId));
            }

            var user = await _userRepository.FindByIdAsync(userId);
            if (user != null)
            {
                await _userRepository.UpdateLastLoginAsync(userId);
            }
            return user;
        }

        public async Task<bool> ValidateUserEligibility(string userId)
        {
            var user = await GetUser(userId);
            return user != null && user.Status == "Active";
        }
    }
}
