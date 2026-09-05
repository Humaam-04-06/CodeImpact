import { SubscriptionService } from "../src/services/SubscriptionService";

describe("SubscriptionService", () => {
  it("should renew valid active subscription", async () => {
    const service = new SubscriptionService();
    const result = await service.renewSubscription("sub_123");
    expect(result.status).toBe("ACTIVE");
  });
});
