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
import { PROJECT_TITLE } from "~/lib/constants";

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
            <div 
              className="rounded-full h-2" 
              style={{ 
                width: `${Math.min(score * 20, 100)}%`,
                backgroundColor: house.color
              }}
            />
          </div>
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
      (Object.entries(HOUSES) as [keyof typeof HOUSES, typeof HOUSES[keyof typeof HOUSES][]).forEach(([houseKey, house]) => {
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

  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        if (!context) {
          throw new Error("Failed to load frame context");
        }

        // Get recent casts for the user
        const response = await fetch(`/api/casts/${session?.user?.fid}`);
        if (!response.ok) {
          throw new Error("Failed to fetch casts");
        }
        
        const casts: string[] = await response.json();
        if (!casts?.length) {
          throw new Error("No casts found for analysis");
        }
        
        const houseResult = await analyzeCasts(casts);
        setHouse(houseResult);
        setLoading(false);

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    }); // Added missing closing brace and parenthesis
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

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
