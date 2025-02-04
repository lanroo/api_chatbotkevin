export interface MetricGrowth {
  current: number;
  previous: number;
  growth: number;
}

export interface UserMetrics {
  count: number;
  growth: number;
  activeNow: number;
  distribution: {
    newUsers: number;
    returning: number;
  };
}

export interface ChatMetrics {
  active: number;
  growth: number;
  total: number;
  avgDuration: number;
  satisfaction: number;
}

export interface ResponseMetrics {
  avgTime: number;
  satisfaction: number;
  firstResponseTime: number;
  resolutionTime: number;
}

export interface MessageMetrics {
  total: number;
  growth: number;
  distribution: {
    user: number;
    bot: number;
  };
}

export interface HourlyDistribution {
  hour: number;
  count: number;
  date: string;
}

export interface InteractionType {
  type: string;
  count: number;
  percentage: number;
}

export interface DashboardMetrics {
  activeUsers: UserMetrics;
  chats: ChatMetrics;
  responses: ResponseMetrics;
  messages: MessageMetrics;
  hourlyDistribution: HourlyDistribution[];
  interactionTypes: InteractionType[];
  period: {
    start: string;
    end: string;
  };
}
