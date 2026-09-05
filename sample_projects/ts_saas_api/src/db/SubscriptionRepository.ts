export interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthly: number;
}

export class SubscriptionRepository {
  async findSubscriptionById(id: string) {
    // Database Query: SELECT * FROM subscriptions WHERE id = $1
    return { id, status: "ACTIVE", plan: "PRO" };
  }

  async updateBillingStatus(id: string, status: string) {
    // Database Mutation: UPDATE subscriptions SET status = $2 WHERE id = $1
    return true;
  }
}
