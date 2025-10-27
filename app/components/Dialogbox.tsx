"use client";

import React from "react";
import { Modal, Text } from "@shopify/polaris";

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    open,
    onClose,
    onConfirm,
    loading = false,
    title = "Disconnect from Square app?",
    message = "Are you sure you want to disconnect from the Square app? This will remove the connection.",
    confirmText = "Disconnect",
    cancelText = "Cancel",
  }) => {
    return (
      <>
        {/* Inline style override for modal background */}
        <style>
          {`
            .Polaris-Backdrop {
              backdrop-filter: blur(1px);
              -webkit-backdrop-filter: blur(6px);
              background-color: rgba(255, 255, 255, 0.01);
            }
          `}
        </style>
  
        <Modal
          open={open}
          onClose={onClose}
          title={title}
          primaryAction={{
            content: confirmText,
            onAction: onConfirm,
            destructive: true,
            loading,
          }}
          secondaryActions={[
            {
              content: cancelText,
              onAction: onClose,
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">{message}</Text>
          </Modal.Section>
        </Modal>
      </>
    );
  };
  

export default ConfirmationModal;
