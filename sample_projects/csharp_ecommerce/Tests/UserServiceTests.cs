using System.Threading.Tasks;
using Xunit;
using ECommerce.Services;
using ECommerce.Repositories;

namespace ECommerce.Tests
{
    public class UserServiceTests
    {
        [Fact]
        public async Task GetUser_ReturnsValidUser_WhenUserExists()
        {
            var repo = new UserRepository();
            var service = new UserService(repo);

            var user = await service.GetUser("user_123");

            Assert.NotNull(user);
            Assert.Equal("Alice Smith", user.Name);
        }
    }
}
