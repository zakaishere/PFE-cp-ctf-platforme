package com.university.platform.runtime;

import java.util.Map;

/** Long-lived instance descriptor. Fields cover only what's currently shared between callers. */
public record InstanceSpec(
        String image,
        int    internalPort,
        int    publishedPort,
        long   memoryBytes,
        double cpus,
        String networkName,
        Map<String, String> env
) {}
