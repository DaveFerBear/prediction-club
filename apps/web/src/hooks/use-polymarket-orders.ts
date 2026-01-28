import useSWRMutation from 'swr/mutation';
import { useApi } from './use-api';
import type { ApiResponse } from '@prediction-club/shared';
import type { OrderType } from '@polymarket/clob-client';

export interface SubmitPolymarketOrderInput {
  order: unknown;
  orderType?: OrderType;
  deferExec?: boolean;
  postOnly?: boolean;
}

export interface CancelPolymarketOrderInput {
  orderID: string;
}

type SubmitOrderResponse = ApiResponse<unknown>;
type CancelOrderResponse = ApiResponse<unknown>;

export function usePolymarketOrders() {
  const { fetch } = useApi();

  const submitMutation = useSWRMutation<SubmitOrderResponse, Error, string, SubmitPolymarketOrderInput>(
    '/api/polymarket/orders',
    (url: string, { arg }: { arg: SubmitPolymarketOrderInput }) =>
      fetch<SubmitOrderResponse>(url, {
        method: 'POST',
        body: JSON.stringify(arg),
      })
  );

  const cancelMutation = useSWRMutation<CancelOrderResponse, Error, string, CancelPolymarketOrderInput>(
    '/api/polymarket/cancel',
    (url: string, { arg }: { arg: CancelPolymarketOrderInput }) =>
      fetch<CancelOrderResponse>(url, {
        method: 'POST',
        body: JSON.stringify(arg),
      })
  );

  return {
    submitOrder: submitMutation.trigger,
    cancelOrder: cancelMutation.trigger,
    isSubmitting: submitMutation.isMutating,
    isCanceling: cancelMutation.isMutating,
    submitError: submitMutation.error,
    cancelError: cancelMutation.error,
  };
}
