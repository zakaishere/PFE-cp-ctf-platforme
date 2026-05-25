"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchProblemsPage, ProblemBrowseDTO } from "@/lib/api";

interface Filters {
  search: string;
  difficulty: string;
}

export function useInfiniteProblems(filters: Filters) {
  const [problems, setProblems]         = useState<ProblemBrowseDTO[]>([]);
  const [page, setPage]                 = useState(0);
  const [hasMore, setHasMore]           = useState(true);
  const [loading, setLoading]           = useState(false);
  const [initialLoad, setInitialLoad]   = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);

  // Reset when filters change
  useEffect(() => {
    setProblems([]);
    setPage(0);
    setHasMore(true);
    setInitialLoad(true);
    setError(null);
  }, [filters.search, filters.difficulty]);

  // Fetch on page change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasMore && page > 0) return;
      setLoading(true);
      try {
        const data = await fetchProblemsPage({
          page,
          search: filters.search || undefined,
          difficulty: filters.difficulty || undefined,
        });
        if (!cancelled) {
          setProblems(prev => page === 0 ? data.content : [...prev, ...data.content]);
          setHasMore(!data.last);
          setTotalElements(data.totalElements);
          setInitialLoad(false);
        }
      } catch {
        if (!cancelled) setError("Failed to load problems. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [page, filters.search, filters.difficulty]);

  // IntersectionObserver sentinel ref
  const observer = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage(prev => prev + 1);
      }
    }, { rootMargin: "200px" });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  return { problems, loading, initialLoad, error, hasMore, totalElements, sentinelRef };
}
