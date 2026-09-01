package com.algorithm.help.content.relation;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.common.enums.RelationType;
import com.algorithm.help.entity.ProblemRelation;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 管理员关联关系管理 API
 */
@RestController
@RequestMapping("/api/v1/admin/relations")
@RequiredArgsConstructor
public class RelationController {

    private final RelationService relationService;

    /**
     * 触发全量关联关系重算（异步执行）
     */
    @PostMapping("/recalculate")
    public ApiResponse<String> recalculate() {
        relationService.calculateAllRelations();
        return ApiResponse.success("关联关系重算任务已提交，异步执行中");
    }

    /**
     * 更新指定关联关系
     */
    @PutMapping("/{id}")
    public ApiResponse<ProblemRelation> update(@PathVariable String id,
                                               @RequestBody UpdateRelationRequest request) {
        ProblemRelation updated = relationService.updateRelation(
                id, request.getType(), request.getDescription(), request.getConfidence());
        if (updated == null) {
            return ApiResponse.error(404, "关联关系不存在: " + id);
        }
        return ApiResponse.success(updated);
    }

    /**
     * 删除指定关联关系
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        boolean deleted = relationService.deleteRelation(id);
        if (!deleted) {
            return ApiResponse.error(404, "关联关系不存在: " + id);
        }
        return ApiResponse.success();
    }

    /**
     * 更新关联关系请求体
     */
    @Data
    public static class UpdateRelationRequest {
        /** 关联类型 */
        private RelationType type;
        /** 描述 */
        private String description;
        /** 置信度 */
        private Float confidence;
    }
}
