"use client";

import { useEffect, useState } from "react";
import {
  Page,
  Card,
  Button,
  Text,
  Box,
  Spinner,
  Badge,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import ConfirmationModal from "./Dialogbox";

export default function OnboardingPage() {
  const app = useAppBridge();
  const [mounted, setMounted] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [squareAccountId, setSquareAccountId] = useState<string | null>(null);
  const [shop, setShop] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [orderCounts, setOrderCounts] = useState<{
    total: number;
    open: number;
    completed: number;
  } | null>(null);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Wait for client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const shopifyShop = app?.config?.shop || "";
    if (shopifyShop) {
      setShop(shopifyShop);
    }
  }, [app, mounted]);

  useEffect(() => {
    if (!mounted || !shop) return;
    checkConnection();
    fetchSummaryData();
  }, [shop, mounted]);

  const checkConnection = async () => {
    try {
      const res = await fetch(
        `/api/square/connection?shop=${encodeURIComponent(shop)}`,
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
        fetch(`/api/square/orders/counts?shop=${encodeURIComponent(shop)}`),
        fetch(`/api/square/catalog/counts?shop=${encodeURIComponent(shop)}`),
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

      setItemCount(itemsData.counts?.total ?? 0);
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
      "_blank",
    );
    setTimeout(() => {
      checkConnection();
      fetchSummaryData();
      setIsConnecting(false);
    }, 3000);
  };

  const handleDisconnect = async () => {
    if (!squareAccountId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/square/${squareAccountId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setConnected(false);
        setSquareAccountId(null);
        setOrderCounts(null);
        setItemCount(null);
      }
    } catch (err) {
      console.error("Failed to disconnect", err);
    } finally {
      setLoading(false);
    }
  };

  // During SSR or before mount, render stable placeholder
  if (!mounted) {
    return (
      <Page title="Welcome to Square Integration">
        <Card>
          <Box padding="400">
            <Spinner accessibilityLabel="Loading page..." size="large" />
          </Box>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Welcome to Square Integration">
      <Card>
        <Box padding="400">
          <Text as="h2" variant="headingLg">
            Welcome to Square Account
          </Text>
          <Text as="p" variant="bodyMd">
            This app helps you sync your Square catalog, orders, and inventory
            with your Shopify store seamlessly.
          </Text>
        </Box>

        {connected === null ? (
          <Box padding="400">
            <Spinner
              accessibilityLabel="Loading connection status"
              size="large"
            />
          </Box>
        ) : !connected ? (
          <Box padding="400">
            <Button
              variant="primary"
              loading={isConnecting}
              onClick={handleConnectSquare}
            >
              {isConnecting ? "Connecting..." : "Connect Square"}
            </Button>
          </Box>
        ) : (
          <>
            <Box padding="400">
              <Text as="p" tone="success" variant="bodyMd">
                Your Square account is now connected! Below is your current sync
                summary
              </Text>
              <Box paddingBlockStart="400">
                <Button
                  onClick={() => setShowConfirmModal(true)}
                  loading={loading}
                  tone="critical"
                  variant="primary"
                >
                  Disconnect from Square
                </Button>
              </Box>
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
                      <Badge tone="success">
                        {orderCounts.total.toString()}
                      </Badge>
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

      <ConfirmationModal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={async () => {
          setShowConfirmModal(false);
          await handleDisconnect();
        }}
        loading={loading}
        title="Disconnect from Square app?"
        message="Are you sure you want to disconnect from the Square app? This will remove the connection."
        confirmText="Disconnect"
        cancelText="Cancel"
      />
    </Page>
  );
}
