import { SubscriptionRepository } from "../db/SubscriptionRepository";

export class SubscriptionService {
  private repo = new SubscriptionRepository();

  async renewSubscription(subscriptionId: string) {
    const sub = await this.repo.findSubscriptionById(subscriptionId);
    if (!sub || sub.status !== "ACTIVE") {
      throw new Error("Subscription not eligible for renewal");
    }
    await this.repo.updateBillingStatus(subscriptionId, "RENEWED");
    return sub;
  }

  async cancelSubscription(subscriptionId: string) {
    const sub = await this.repo.findSubscriptionById(subscriptionId);
    await this.repo.updateBillingStatus(subscriptionId, "CANCELLED");
    return true;
  }
}
