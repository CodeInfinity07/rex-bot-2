import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Activity } from "lucide-react";

export default function ActivityLogs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-logs">Activity Logs</h1>
        <p className="text-muted-foreground mt-1">Real-time bot activity and events</p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <CardTitle>Coming Soon</CardTitle>
          </div>
          <CardDescription>
            Activity logging feature is currently under development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-2">Planned Features:</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• Real-time activity monitoring</li>
                <li>• User join/leave notifications</li>
                <li>• Message moderation logs</li>
                <li>• Bot command execution history</li>
                <li>• Kick/ban event tracking</li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4 pt-4 border-t">
            This feature will be available in an upcoming update. Stay tuned!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}