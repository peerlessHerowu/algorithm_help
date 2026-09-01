package com.algorithm.help.mapping;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.mapping.dto.CreateMappingRequest;
import com.algorithm.help.mapping.dto.MappingDTO;
import com.algorithm.help.mapping.enums.MappingStatus;
import com.algorithm.help.mapping.enums.Platform;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

/**
 * 映射管理 REST API（管理员端点）
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/mappings")
public class MappingAdminController {

    private final MappingAdminService mappingAdminService;

    /**
     * 映射列表（分页，支持 platform/status 筛选）
     */
    @GetMapping
    public ApiResponse<Page<MappingDTO>> list(
            @RequestParam(required = false) Platform platform,
            @RequestParam(required = false) MappingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<MappingDTO> result = mappingAdminService.listMappings(platform, status, page, size);
        return ApiResponse.success(result);
    }

    /**
     * 确认映射
     */
    @PutMapping("/{id}/confirm")
    public ApiResponse<MappingDTO> confirm(@PathVariable String id) {
        MappingDTO result = mappingAdminService.confirmMapping(id);
        return ApiResponse.success(result);
    }

    /**
     * 拒绝映射
     */
    @PutMapping("/{id}/reject")
    public ApiResponse<MappingDTO> reject(@PathVariable String id) {
        MappingDTO result = mappingAdminService.rejectMapping(id);
        return ApiResponse.success(result);
    }

    /**
     * 手动创建映射
     */
    @PostMapping
    public ApiResponse<MappingDTO> create(@RequestBody CreateMappingRequest request) {
        MappingDTO result = mappingAdminService.createMapping(request);
        return ApiResponse.success(result);
    }
}
