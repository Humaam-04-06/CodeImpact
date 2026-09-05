using System;
using System.Threading.Tasks;

namespace ECommerce.Repositories
{
    public class UserRepository
    {
        // Database operation 1: Read user record
        public async Task<UserRecord> FindByIdAsync(string userId)
        {
            // Simulates SQL / EF Core query: SELECT * FROM Users WHERE Id = @userId
            await Task.Delay(10);
            return new UserRecord { Id = userId, Name = "Alice Smith", Email = "alice@example.com", Status = "Active" };
        }

        // Database operation 2: Update audit timestamp
        public async Task UpdateLastLoginAsync(string userId)
        {
            // Simulates SQL: UPDATE Users SET LastLogin = UTC_NOW() WHERE Id = @userId
            await Task.Delay(5);
        }
    }

    public class UserRecord
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Status { get; set; }
    }
}
