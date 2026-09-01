package com.algorithm.help.mapping.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.mapping.dto.CsvImportResult;
import com.algorithm.help.mapping.dto.PlatformLinkDTO;
import com.algorithm.help.mapping.entity.PlatformMapping;
import com.algorithm.help.mapping.enums.MappingStatus;
import com.algorithm.help.mapping.enums.Platform;
import com.algorithm.help.mapping.repository.PlatformMappingRepository;
import com.algorithm.help.mapping.service.MappingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 多平台题目映射 API 控制器
 * <p>
 * 提供映射解析、CSV 导入、跨平台链接查询和人工确认等功能
 */
@RestController
@RequestMapping("/api/mapping")
@RequiredArgsConstructor
public class MappingController {

    private final MappingService mappingService;
    private final PlatformMappingRepository mappingRepo;

    /**
     * 解析映射：根据平台和平台 ID 获取统一题目 ID
     *
     * @param platform   刷题平台枚举
     * @param platformId 平台编号/slug
     * @return 统一题目 ID，不存在返回 404
     */
    @GetMapping("/resolve")
    public ApiResponse<String> resolve(@RequestParam Platform platform,
                                       @RequestParam String platformId) {
        return mappingService.resolve(platform, platformId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "映射不存在"));
    }

    /**
     * CSV 文件上传导入映射数据
     *
     * @param file CSV 文件
     * @return 导入结果报告
     */
    @PostMapping("/import")
    public ApiResponse<CsvImportResult> importCsv(@RequestParam("file") MultipartFile file) {
        CsvImportResult result = mappingService.importFromCsv(file);
        return ApiResponse.success(result);
    }

    /**
     * 获取某题在所有平台上的链接
     *
     * @param id 统一题目 ID
     * @return 平台链接列表
     */
    @GetMapping("/problem/{id}/links")
    public ApiResponse<List<PlatformLinkDTO>> getLinks(@PathVariable String id) {
        List<PlatformLinkDTO> links = mappingService.getLinks(id);
        return ApiResponse.success(links);
    }

    /**
     * 人工确认 PENDING 状态的映射
     *
     * @param id 映射记录 ID
     * @return 确认成功或 404
     */
    @PutMapping("/{id}/confirm")
    public ApiResponse<Void> confirm(@PathVariable String id) {
        return mappingRepo.findById(id)
                .map(this::confirmMapping)
                .orElse(ApiResponse.error(404, "映射记录不存在"));
    }

    /**
     * 执行确认逻辑：将 PENDING 状态改为 CONFIRMED
     */
    private ApiResponse<Void> confirmMapping(PlatformMapping mapping) {
        mapping.setStatus(MappingStatus.CONFIRMED);
        mappingRepo.save(mapping);
        return ApiResponse.success();
    }
}
