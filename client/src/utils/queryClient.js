import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes: instant data access across tabs/views without refetch delays
            gcTime: 1000 * 60 * 15,    // 15 minutes cache garbage collection
            refetchOnWindowFocus: false, // Avoid jarring refetches on window switch
            retry: 1,
        },
    },
});

export const invalidateQueries = (queryKey) => {
    return queryClient.invalidateQueries({ queryKey });
};

export const setQueryData = (queryKey, updater) => {
    return queryClient.setQueryData(queryKey, updater);
};

export const getQueryData = (queryKey) => {
    return queryClient.getQueryData(queryKey);
};
