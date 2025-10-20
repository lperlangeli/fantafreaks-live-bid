import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatisticsSection() {
  return (
    <Card className="h-[calc(100vh-200px)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Statistiche</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Sezione in sviluppo</p>
      </CardContent>
    </Card>
  );
}
