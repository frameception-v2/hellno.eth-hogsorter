"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE, HOUSES } from "~/lib/constants";

function HouseCard({ house, score }: { house: typeof HOUSES[keyof typeof HOUSES]; score: number }) {
  return (
    <Card style={{ borderColor: house.color }}>
      <CardHeader>
        <CardTitle style={{ color: house.color }}>{house.name}</CardTitle>
        <CardDescription>{house.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div>Matching traits: {house.traits.join(", ")}</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
          </div>
          <div 
            className="rounded-full h-2" 
            style={{ 
              width: `${Math.min(score * 20, 100)}%`,
              backgroundColor: house.color
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

async function analyzeCasts(casts: string[]) {
  const houseScores = new Map<keyof typeof HOUSES, number>();
  
  // Initialize scores
  (Object.keys(HOUSES) as (keyof typeof HOUSES)[]).forEach(house => {
    houseScores.set(house, 0);
  });

  // Analyze each cast
  casts.forEach(cast => {
    const words = cast.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
      (Object.entries(HOUSES) as Array<[keyof typeof HOUSES, typeof HOUSES[keyof typeof HOUSES]]>).forEach(([houseKey, house]) => {
        if (house.keywords.some(keyword => word.includes(keyword))) {
          houseScores.set(houseKey, (houseScores.get(houseKey) || 0) + 1);
        }
      });
    });
  });

  // Get house with highest score
  let sortedHouses = Array.from(houseScores.entries())
    .sort((a, b) => b[1] - a[1]);
  
  // Handle tie between first places
  const topScore = sortedHouses[0][1];
  const topHouses = sortedHouses.filter(([_, score]) => score === topScore);
  
  return topHouses.length > 1 
    ? HOUSES.HUFFLEPUFF // Default to Hufflepuff for ties
    : HOUSES[sortedHouses[0][0]];
}

export default function Frame() {
  const { data: session } = useSession();
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [house, setHouse] = useState<typeof HOUSES[keyof typeof HOUSES]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

      } catch (error) {
        console.error("Initialization error:", error);
        setError(error instanceof Error ? error.message : "Unknown error");
        setLoading(false);
      }
    };

    const initSDK = async () => {
      try {
        // Initialize SDK first
        await sdk.actions.ready({});
        setIsSDKLoaded(true);
        
        // Then load user data
        await load();
        
        // Set up MIPD store after SDK is ready
        const store = createStore();
        store.subscribe((providerDetails) => {
          console.log("PROVIDER DETAILS", providerDetails);
        });

        // Set up event listeners
        sdk.on("frameAdded", () => setAdded(true));
        sdk.on("frameAddRejected", ({ reason }) => console.log("frameAddRejected", reason));
        sdk.on("frameRemoved", () => setAdded(false));
        sdk.on("notificationsEnabled", (details) => console.log("notificationsEnabled", details));
        sdk.on("notificationsDisabled", () => console.log("notificationsDisabled"));
        sdk.on("primaryButtonClicked", () => console.log("primaryButtonClicked"));

      } catch (error) {
        console.error("SDK initialization error:", error);
        setError(error instanceof Error ? error.message : "Unknown SDK error");
      }
    };
    
    if (sdk && session?.user?.fid) {
      initSDK();
      return () => sdk.removeAllListeners();
    }
  }, [session?.user?.fid, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        {house && <HouseCard house={house} score={5} />}
      </div>
    </div>
  );
}
