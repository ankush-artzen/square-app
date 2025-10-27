"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Page,
  Card,
  Button,
  Text,
  Box,
  Spinner,
  Banner,
  Divider,
  Icon,
  InlineStack,
  BlockStack,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { CheckSmallIcon, StoreIcon, OrderIcon } from "@shopify/polaris-icons";

export default function OnboardingSquare() {
  const app = useAppBridge();
  const router = useRouter();

  const [shop, setShop] = useState("");
  const [squareAccountId, setSquareAccountId] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const shopifyShop = app?.config?.shop || "";
    setShop(shopifyShop);
  }, [app]);

  useEffect(() => {
    if (!shop) return;
    checkConnection();
  }, [shop]);

  const checkConnection = async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/square/connection?shop=${encodeURIComponent(shop)}`);
      if (!res.ok) throw new Error("Failed to fetch connection status");
      const data = await res.json();
      setConnected(Boolean(data.connected));
      setSquareAccountId(data.id || null);
    } catch (err) {
      console.error("checkConnection error:", err);
      setConnected(false);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnectSquare = () => {
    setLoading(true);
    router.push("/api/square/connect");
  };

  return (
    <Page title="Square Integration Setup">
      <Card>
        <Box padding="400">
          {checkingStatus ? (
            <InlineStack align="center" blockAlign="center">
              <Spinner accessibilityLabel="Checking Square connection" size="large" />
            </InlineStack>
          ) : (
            <BlockStack gap="500">
              {/* Connection status */}
              {connected ? (
                <Banner title="Square Connected" tone="info">
                  <Text as="p" variant="bodyMd">
                    Your Square account is linked! You can now sync products, orders, and inventory in real time.
                  </Text>
                </Banner>
              ) : (
                <Banner title="Square Not Connected" tone="warning">
                  <Text as="p" variant="bodyMd">
                    Connect your Square account to start syncing products and orders.
                  </Text>
                </Banner>
              )}

              {/* Step 1 */}
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  {/* <Icon source={StoreIcon} tone="base" /> */}
                  <Text as="h3" variant="headingLg">
                    Step 1: Connect your Square account
                  </Text>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Securely link your Square account to sync inventory and orders in real time.
                </Text>
                {connected ? (
                  <Text as="p" tone="success" variant="bodyMd">
                    ✅ Your Square account is connected.
                  </Text>
                ) : (
                  <Box width="auto">
                  <Button
                    variant="primary"
                    onClick={handleConnectSquare}
                    loading={loading}
                  >
                    Connect Square Account
                  </Button>
                </Box>
                
                )}
              </BlockStack>

              <Divider />

              {/* Step 2 */}
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  {/* <Icon source={OrderIcon} tone="base" /> */}
                  <Text as="h3" variant="headingLg">
                    Step 2: How the app works
                  </Text>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Once connected, the app automatically imports your Square products, keeps inventory in sync, and
                  lets you manage orders seamlessly from Shopify.
                </Text>
              </BlockStack>

              <Divider />

              {/* Step 3 */}
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  {/* <Icon source={CheckSmallIcon} tone="base" /> */}
                  <Text as="h3" variant="headingLg">
                    Step 3: Start Insights!
                  </Text>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                Once Square data syncs, our AI analyzes transactions to deliver actionable insights, trends, and business growth recommendations instantly
                </Text>
              </BlockStack>
            </BlockStack>
          )}
        </Box>
      </Card>
    </Page>
  );
}
