package com.algorithm.help;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 算法深度理解引擎 - 应用启动类
 */
@SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
public class AlgorithmHelpApplication {

    public static void main(String[] args) {
        SpringApplication.run(AlgorithmHelpApplication.class, args);
    }
}
