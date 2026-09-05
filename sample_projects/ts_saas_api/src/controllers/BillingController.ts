import { SubscriptionService } from "../services/SubscriptionService";

export class BillingController {
  private subscriptionService = new SubscriptionService();

  async processRenewal(req: { subscriptionId: string }) {
    const result = await this.subscriptionService.renewSubscription(req.subscriptionId);
    return { success: true, data: result };
  }

  async handleCancellation(req: { subscriptionId: string }) {
    await this.subscriptionService.cancelSubscription(req.subscriptionId);
    return { success: true, message: "Subscription cancelled" };
  }
}
