"use client";

import { useEffect, useState } from "react";
import {
  Page,
  Card,
  Button,
  Text,
  Box,
  Banner,
  Link,
  Spinner,
  Badge,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function OnboardingPage() {
  const app = useAppBridge();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [squareAccountId, setSquareAccountId] = useState<string | null>(null);
  const [shop, setShop] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const [orderCounts, setOrderCounts] = useState<{
    total: number;
    open: number;
    completed: number;
  } | null>(null);

  const [itemCount, setItemCount] = useState<number | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    const shopifyShop = app?.config?.shop || "";
    setShop(shopifyShop);
  }, [app]);

  useEffect(() => {
    if (!shop) return;
    checkConnection();
    fetchSummaryData();
  }, [shop]);

  const checkConnection = async () => {
    try {
      const res = await fetch(
        `/api/square/connection?shop=${encodeURIComponent(shop)}`
      );
      const data = await res.json();
      setConnected(Boolean(data.connected));
      setSquareAccountId(data.id || null);
    } catch (err) {
      console.error("checkConnection error:", err);
      setConnected(false);
    }
  };

  const fetchSummaryData = async () => {
    setSummaryLoading(true);
    try {
      const [ordersRes, itemsRes] = await Promise.all([
        fetch(`/api/square/orders?shop=${encodeURIComponent(shop)}`),
        fetch(`/api/square/catalog?shop=${encodeURIComponent(shop)}`),
      ]);

      if (!ordersRes.ok) throw new Error("Failed to fetch orders");
      if (!itemsRes.ok) throw new Error("Failed to fetch catalog items");

      const ordersData = await ordersRes.json();
      const itemsData = await itemsRes.json();

      setOrderCounts({
        total: ordersData.counts?.total ?? 0,
        open: ordersData.counts?.open ?? 0,
        completed: ordersData.counts?.completed ?? 0,
      });

      setItemCount(Array.isArray(itemsData.items) ? itemsData.items.length : 0);
    } catch (err) {
      console.error("fetchSummaryData error:", err);
      setOrderCounts(null);
      setItemCount(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleConnectSquare = async () => {
    setIsConnecting(true);
    window.open(
      `/api/square/authorize?shop=${encodeURIComponent(shop)}`,
      "_blank"
    );
    setTimeout(() => {
      checkConnection();
      fetchSummaryData();
      setIsConnecting(false);
    }, 3000);
  };

  return (
    <Page title="Welcome to Square Integration">
      <Card>
        <Box padding="400">
          <Text as="h2" variant="headingLg">
            Get Started with Your Square Account
          </Text>
          <Text as="p" variant="bodyMd">
            This app helps you sync your Square catalog, orders, and inventory
            with your Shopify store seamlessly.
          </Text>
        </Box>

        {connected === null ? (
          <Box padding="400">
            <Spinner accessibilityLabel="Loading connection status" size="large" />
          </Box>
        ) : !connected ? (
          <Box padding="400">
            <Banner title="Step 1: Connect your Square account" tone="info">
              <Text as="p" variant="bodyMd">
                Click the button below to securely connect your Square account
                and authorize Shopify to sync data.
              </Text>
              <Button
                variant="primary"
                loading={isConnecting}
                onClick={handleConnectSquare}
              >
                {isConnecting ? "Connecting..." : "Connect Square"}
              </Button>
            </Banner>
          </Box>
        ) : (
          <>
            <Box padding="400">
              <Banner title="✅ Square Connected" tone="success">
                <Text as="p" variant="bodyMd">
                  Your Square account is now connected! Below is your current sync
                  summary:
                </Text>
              </Banner>
            </Box>

            <Card>
              {summaryLoading ? (
                <Box padding="400">
                  <Spinner accessibilityLabel="Loading summary" size="large" />
                </Box>
              ) : (
                <>
                  {orderCounts && (
                    <Text as="h3" variant="headingMd">
                      Total Orders Syncing:{" "}
                      <Badge tone="success">{orderCounts.total.toString()}</Badge>
                    </Text>
                  )}
                  {itemCount !== null && (
                    <Text as="h3" variant="headingMd">
                      Total Items Syncing:{" "}
                      <Badge tone="success">{itemCount.toString()}</Badge>
                    </Text>
                  )}
                </>
              )}
            </Card>
          </>
        )}

        
      </Card>
    </Page>
  );
}
