import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Activity, Bot } from "lucide-react";

interface MembersResponse {
  success: boolean;
  data: {
    members: any[];
    total: number;
    levelStats: {
      total: number;
      lowLevel: number;
      mediumLevel: number;
      highLevel: number;
    };
  };
}

interface ProtectionResponse {
  success: boolean;
  data: string[];
}

interface BotStatusResponse {
  success: boolean;
  data: {
    connected: boolean;
    message: string;
  };
}

interface ClubInfoResponse {
  success: boolean;
  data: {
    clubName: string;
    clubCode: string;
    botUid: string;
  };
}

interface MessageCountResponse {
  success: boolean;
  data: {
    count: number;
    date: string;
  };
}

export default function Overview() {
  const { data: membersData } = useQuery<MembersResponse>({
    queryKey: ["/api/jack/members"],
  });

  const { data: spamWordsData } = useQuery<ProtectionResponse>({
    queryKey: ["/api/jack/config/spam-words"],
  });

  const { data: botStatus } = useQuery<BotStatusResponse>({
    queryKey: ["/api/jack/status"],
  });

  const { data: clubInfo } = useQuery<ClubInfoResponse>({
    queryKey: ["/api/jack/club-info"],
  });

  const { data: messageCount } = useQuery<MessageCountResponse>({
    queryKey: ["/api/jack/message-count"],
    refetchInterval: 5000,
  });

  const totalMembers = membersData?.data?.total || 0;
  const messagesToday = messageCount?.data?.count || 0;
  const spamWordCount = spamWordsData?.data?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-dashboard">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">Monitor your bot and club statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-members">{totalMembers}</div>
            <p className="text-xs text-muted-foreground">Club members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-messages-today">{messagesToday}</div>
            <p className="text-xs text-muted-foreground">Bot activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spam Words</CardTitle>
            <Shield className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-spam-words">{spamWordCount}</div>
            <p className="text-xs text-muted-foreground">Protected terms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
            <Bot className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {botStatus?.data?.connected ? "Online" : "Ready"}
            </div>
            <p className="text-xs text-muted-foreground">System status</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Club Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Club Name</p>
              <p className="font-semibold" data-testid="text-club-name">
                {clubInfo?.data?.clubName || 'Loading...'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Club Code</p>
              <p className="font-semibold" data-testid="text-club-code">
                {clubInfo?.data?.clubCode || 'Loading...'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Member Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Level 1-4</span>
              <span className="font-semibold" data-testid="stat-overview-low">
                {membersData?.data?.levelStats?.lowLevel || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Level 5-9</span>
              <span className="font-semibold" data-testid="stat-overview-medium">
                {membersData?.data?.levelStats?.mediumLevel || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Level 10+</span>
              <span className="font-semibold" data-testid="stat-overview-high">
                {membersData?.data?.levelStats?.highLevel || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
