package com.nchp.monitoring.app; // <-- THIS IS THE CRITICAL FIX

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        BackgroundUpdateWorker.openActivities++;
        super.onCreate(savedInstanceState);
        // New over-the-air releases are also fetched while the app is closed.
        BackgroundUpdateWorker.schedule(this);
    }

    @Override
    public void onDestroy() {
        BackgroundUpdateWorker.openActivities = Math.max(0, BackgroundUpdateWorker.openActivities - 1);
        super.onDestroy();
    }
}
