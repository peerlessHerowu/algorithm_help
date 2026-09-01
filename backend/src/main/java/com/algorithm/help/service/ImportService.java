package com.algorithm.help.service;

import com.algorithm.help.controller.dto.ImportResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 导入服务骨架：从 URL 导入题目
 */
@Slf4j
@Service
public class ImportService {

    /**
     * 从 URL 导入题目（骨架实现，返回占位结果）
     */
    public ImportResult importFromUrl(String url) {
        log.info("收到导入请求, url={}", url);
        String taskId = UUID.randomUUID().toString();
        return new ImportResult()
            .setTaskId(taskId)
            .setStatus("PENDING")
            .setMessage("导入任务已创建，URL: " + url);
    }
}
