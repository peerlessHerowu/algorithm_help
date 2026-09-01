package com.algorithm.help.mapping;

import com.algorithm.help.mapping.dto.CreateMappingRequest;
import com.algorithm.help.mapping.dto.MappingDTO;
import com.algorithm.help.mapping.entity.PlatformMapping;
import com.algorithm.help.mapping.enums.MappingStatus;
import com.algorithm.help.mapping.enums.Platform;
import com.algorithm.help.mapping.repository.PlatformMappingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/**
 * 映射管理业务逻辑
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MappingAdminService {

    private final PlatformMappingRepository mappingRepo;

    /**
     * 分页查询映射列表（支持 platform/status 筛选）
     */
    public Page<MappingDTO> listMappings(Platform platform, MappingStatus status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PlatformMapping> result = queryMappings(platform, status, pageable);
        return result.map(this::toDTO);
    }

    /**
     * 确认映射
     */
    public MappingDTO confirmMapping(String id) {
        PlatformMapping mapping = findOrThrow(id);
        mapping.setStatus(MappingStatus.CONFIRMED);
        mappingRepo.save(mapping);
        log.info("确认映射: {} (platform={}, platformId={})", id, mapping.getPlatform(), mapping.getPlatformId());
        return toDTO(mapping);
    }

    /**
     * 拒绝映射
     */
    public MappingDTO rejectMapping(String id) {
        PlatformMapping mapping = findOrThrow(id);
        mapping.setStatus(MappingStatus.REJECTED);
        mappingRepo.save(mapping);
        log.info("拒绝映射: {} (platform={}, platformId={})", id, mapping.getPlatform(), mapping.getPlatformId());
        return toDTO(mapping);
    }

    /**
     * 手动创建映射
     */
    public MappingDTO createMapping(CreateMappingRequest request) {
        PlatformMapping mapping = new PlatformMapping()
                .setUnifiedProblemId(request.getUnifiedProblemId())
                .setPlatform(request.getPlatform())
                .setPlatformId(request.getPlatformId())
                .setPlatformUrl(request.getPlatformUrl())
                .setPlatformTitle(request.getPlatformTitle())
                .setStatus(MappingStatus.CONFIRMED);
        mappingRepo.save(mapping);
        log.info("手动创建映射: platform={}, platformId={}, unifiedProblemId={}",
                request.getPlatform(), request.getPlatformId(), request.getUnifiedProblemId());
        return toDTO(mapping);
    }

    // ======================== 私有方法 ========================

    private Page<PlatformMapping> queryMappings(Platform platform, MappingStatus status, PageRequest pageable) {
        if (platform != null && status != null) {
            return mappingRepo.findByPlatformAndStatus(platform, status, pageable);
        } else if (platform != null) {
            return mappingRepo.findByPlatform(platform, pageable);
        } else if (status != null) {
            return mappingRepo.findByStatus(status, pageable);
        } else {
            return mappingRepo.findAll(pageable);
        }
    }

    private PlatformMapping findOrThrow(String id) {
        return mappingRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("映射不存在: " + id));
    }

    private MappingDTO toDTO(PlatformMapping entity) {
        return new MappingDTO()
                .setId(entity.getId())
                .setUnifiedProblemId(entity.getUnifiedProblemId())
                .setPlatform(entity.getPlatform())
                .setPlatformId(entity.getPlatformId())
                .setPlatformUrl(entity.getPlatformUrl())
                .setPlatformTitle(entity.getPlatformTitle())
                .setStatus(entity.getStatus())
                .setCreatedAt(entity.getCreatedAt())
                .setUpdatedAt(entity.getUpdatedAt());
    }
}
