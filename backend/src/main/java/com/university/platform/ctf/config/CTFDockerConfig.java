package com.university.platform.ctf.config;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.core.DefaultDockerClientConfig;
import com.github.dockerjava.core.DockerClientImpl;
import com.github.dockerjava.httpclient5.ApacheDockerHttpClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.net.URI;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

@Slf4j
@Configuration
public class CTFDockerConfig {

    @Value("${docker.host:unix:///var/run/docker.sock}")
    private String dockerHost;

    /**
     * Returns a connected DockerClient or null if Docker is not available.
     * The bean is marked @Nullable so CTFInstanceService can accept null safely.
     * When null, instance management runs in mock mode (STARTING→RUNNING with no container).
     */
    @Bean
    @org.springframework.lang.Nullable
    public DockerClient dockerClient() {
        try {
            DefaultDockerClientConfig cfg = DefaultDockerClientConfig
                    .createDefaultConfigBuilder()
                    .withDockerHost(dockerHost)
                    .build();
            ApacheDockerHttpClient http = new ApacheDockerHttpClient.Builder()
                    .dockerHost(URI.create(dockerHost))
                    .maxConnections(20)
                    .build();
            DockerClient client = DockerClientImpl.getInstance(cfg, http);
            client.pingCmd().exec();
            log.info("Docker client connected: {}", dockerHost);
            return client;
        } catch (Throwable e) {
            log.warn("Docker unavailable at {} — instance management in mock mode: {}", dockerHost, e.getMessage());
            return null;
        }
    }

    @Bean("ctfInstanceExecutor")
    public Executor ctfInstanceExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(3);
        exec.setMaxPoolSize(10);
        exec.setQueueCapacity(50);
        exec.setThreadNamePrefix("ctf-instance-");
        exec.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(30);
        exec.initialize();
        return exec;
    }

    @Bean("ctfBuildExecutor")
    public Executor ctfBuildExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(2);
        exec.setMaxPoolSize(5);
        exec.setQueueCapacity(20);
        exec.setThreadNamePrefix("ctf-build-");
        exec.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(60);
        exec.initialize();
        return exec;
    }
}
