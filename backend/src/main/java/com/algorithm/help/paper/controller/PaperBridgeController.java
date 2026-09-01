package com.algorithm.help.paper.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.paper.dto.PaperBridgeDTO;
import com.algorithm.help.paper.entity.PaperBridge;
import com.algorithm.help.paper.enums.FrontierDomain;
import com.algorithm.help.paper.service.PaperBridgeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 论文桥梁 API 控制器
 */
@RestController
@RequestMapping("/api/paper-bridge")
@RequiredArgsConstructor
public class PaperBridgeController {

    private final PaperBridgeService bridgeService;

    /**
     * 按领域获取论文桥梁列表
     */
    @GetMapping("/domain/{domain}")
    public ApiResponse<List<PaperBridge>> getByDomain(@PathVariable FrontierDomain domain) {
        List<PaperBridge> bridges = bridgeService.getByDomain(domain);
        return ApiResponse.success(bridges);
    }

    /**
     * 获取论文桥梁详情
     * <p>
     * 支持 level 参数（3/4/5）进行分级解读查询；
     * 当请求的级别不可用时，返回 coming_soon 降级响应；
     * 不传 level 时返回完整实体信息。
     */
    @GetMapping("/{id}")
    public ApiResponse<?> getById(
            @PathVariable String id,
            @RequestParam(required = false) Integer level) {
        if (level != null) {
            PaperBridgeDTO dto = bridgeService.getById(id, level);
            return ApiResponse.success(dto);
        }
        PaperBridge bridge = bridgeService.getById(id);
        return ApiResponse.success(bridge);
    }
}
