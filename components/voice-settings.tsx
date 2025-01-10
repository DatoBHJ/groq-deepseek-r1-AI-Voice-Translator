"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceSettingsProps {
  onSettingsChange: (settings: VoiceSettings) => void;
  currentSettings: VoiceSettings;
}

export interface VoiceSettings {
  silenceThreshold: number;
  silenceTimeout: number;
  smoothingTimeConstant: number;
}

const environmentPresets = {
  quiet: {
    name: "Quiet Room",
    description: "For office or home",
    settings: {
      silenceThreshold: -40,
      silenceTimeout: 800,
      smoothingTimeConstant: 0.85,
    },
  },
  moderate: {
    name: "Coffee Shop",
    description: "For cafes or restaurants",
    settings: {
      silenceThreshold: -30,
      silenceTimeout: 1000,
      smoothingTimeConstant: 0.92,
    },
  },
  noisy: {
    name: "Street",
    description: "For outdoor or noisy places",
    settings: {
      silenceThreshold: -25,
      silenceTimeout: 1200,
      smoothingTimeConstant: 0.98,
    },
  },
};

export function VoiceSettings({ onSettingsChange, currentSettings }: VoiceSettingsProps) {
  const handlePresetClick = (preset: typeof environmentPresets[keyof typeof environmentPresets]) => {
    onSettingsChange(preset.settings);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 right-4 h-10 w-10 rounded-full border-none shadow-none"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[90vw] sm:max-w-[400px] bg-white">
        <SheetTitle className="text-lg font-medium mb-8">Voice Detection Settings</SheetTitle>
        <div className="space-y-8">
          <div className="space-y-6">
            {/* Environment Presets */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Quick Settings</h3>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(environmentPresets).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant="outline"
                    className={cn(
                      "h-auto py-4 justify-start text-left",
                      "hover:bg-gray-50 transition-colors"
                    )}
                    onClick={() => handlePresetClick(preset)}
                  >
                    <div>
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-xs text-gray-500">{preset.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Advanced Settings</h3>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm">Voice Sensitivity</label>
                    <span className="text-xs text-gray-500">{currentSettings.silenceThreshold}dB</span>
                  </div>
                  <Slider
                    value={[currentSettings.silenceThreshold]}
                    min={-60}
                    max={-20}
                    step={1}
                    onValueChange={([value]) =>
                      onSettingsChange({ ...currentSettings, silenceThreshold: value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm">Pause Duration</label>
                    <span className="text-xs text-gray-500">{currentSettings.silenceTimeout}ms</span>
                  </div>
                  <Slider
                    value={[currentSettings.silenceTimeout]}
                    min={500}
                    max={2000}
                    step={100}
                    onValueChange={([value]) =>
                      onSettingsChange({ ...currentSettings, silenceTimeout: value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm">Voice Smoothing</label>
                    <span className="text-xs text-gray-500">
                      {currentSettings.smoothingTimeConstant.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[currentSettings.smoothingTimeConstant * 100]}
                    min={50}
                    max={100}
                    step={5}
                    onValueChange={([value]) =>
                      onSettingsChange({
                        ...currentSettings,
                        smoothingTimeConstant: value / 100,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
} 