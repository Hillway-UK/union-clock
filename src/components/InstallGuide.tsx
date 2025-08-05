import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone, Download, Home, Share, Plus } from 'lucide-react';

export default function InstallGuide() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Install Time Keeper
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Install Time Keeper as an app on your iPhone for the best experience!
              </p>
            </div>

            {/* iOS Installation Steps */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">iOS Installation Steps:</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium">Open in Safari</p>
                    <p className="text-sm text-muted-foreground">Make sure you're viewing this page in Safari browser</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</div>
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2">
                      Tap the Share button
                      <Share className="h-4 w-4" />
                    </p>
                    <p className="text-sm text-muted-foreground">Look for the share icon at the bottom of your screen</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</div>
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2">
                      Select "Add to Home Screen"
                      <Plus className="h-4 w-4" />
                    </p>
                    <p className="text-sm text-muted-foreground">Scroll down in the share menu to find this option</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <p className="font-medium">Confirm Installation</p>
                    <p className="text-sm text-muted-foreground">Tap "Add" to install Time Keeper to your home screen</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">✓</div>
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2">
                      Done!
                      <Home className="h-4 w-4" />
                    </p>
                    <p className="text-sm text-muted-foreground">Time Keeper is now installed on your home screen like a native app</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold">Benefits of Installing:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                  Works offline for better reliability
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                  Faster loading and smoother performance
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                  Full-screen experience without browser bars
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                  Easy access from your home screen
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                  Push notifications for important updates
                </li>
              </ul>
            </div>

            {/* Troubleshooting */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold">Troubleshooting:</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>Can't find "Add to Home Screen"?</strong></p>
                <p>Make sure you're using Safari browser, not Chrome or other browsers.</p>
                
                <p className="pt-2"><strong>App not working properly?</strong></p>
                <p>Try refreshing the page or reinstalling the app.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}