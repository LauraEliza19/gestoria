import { useFocusEffect } from 'expo-router';

import {
    useCallback,
    useRef,
    useState,
} from 'react';

import type { Product } from './productTypes';
import { listProducts } from './services/productService';

const DEFAULT_ERROR =
    'Não foi possível carregar os produtos. Tente novamente.';

function getErrorMessage(error: unknown) {
    if (
        error instanceof Error &&
        error.message.trim()
    ) {
        return error.message;
    }

    return DEFAULT_ERROR;
}

export function useProducts() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mounted = useRef(true);
    const requestSequence = useRef(0);

    const loadProducts = useCallback(
        async (refresh = false) => {
            const sequence = ++requestSequence.current;

            if (refresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError(null);

            try {
                const response = await listProducts();

                if (
                    mounted.current &&
                    sequence === requestSequence.current
                ) {
                    setProducts(response);
                }
            } catch (requestError) {
                if (
                    mounted.current &&
                    sequence === requestSequence.current
                ) {
                    setError(getErrorMessage(requestError));
                }
            } finally {
                if (
                    mounted.current &&
                    sequence === requestSequence.current
                ) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        []
    );

    useFocusEffect(
        useCallback(() => {
            mounted.current = true;
            const sequence = ++requestSequence.current;

            listProducts()
                .then((response) => {
                    if (
                        mounted.current &&
                        sequence === requestSequence.current
                    ) {
                        setProducts(response);
                        setError(null);
                    }
                })
                .catch((requestError: unknown) => {
                    if (
                        mounted.current &&
                        sequence === requestSequence.current
                    ) {
                        setError(getErrorMessage(requestError));
                    }
                })
                .finally(() => {
                    if (
                        mounted.current &&
                        sequence === requestSequence.current
                    ) {
                        setLoading(false);
                    }
                });

            return () => {
                mounted.current = false;
            };
        }, [])
    );

    const retry = useCallback(() => {
        void loadProducts();
    }, [loadProducts]);

    const refresh = useCallback(() => {
        void loadProducts(true);
    }, [loadProducts]);

    return {
        products,
        loading,
        refreshing,
        error,
        retry,
        refresh,
    };
}