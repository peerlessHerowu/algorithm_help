package com.algorithm.help.content.enrichment;

import com.algorithm.help.content.enrichment.dto.*;
import com.algorithm.help.entity.Explanation;
import com.algorithm.help.internal.entity.UserSolution;
import com.algorithm.help.internal.repository.UserSolutionRepository;
import com.algorithm.help.repository.ExplanationRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 统一查询服务
 * <p>
 * enriched 优先 + legacy fallback + 标签聚合 + Redis 缓存
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UnifiedExplanationService {

    private static final String LIST_CACHE_KEY = "enriched:list:%s:L%d";
    private static final String DETAIL_CACHE_KEY = "enriched:detail:%s";
    private static final String TAGS_CACHE_KEY = "enriched:tags:%s:L%d";
    private static final String RAW_CACHE_KEY = "raw-solutions:%s:page%d:%s:%s";

    private static final long LIST_TTL_HOURS = 1;
    private static final long DETAIL_TTL_HOURS = 24;
    private static final long TAGS_TTL_HOURS = 1;
    private static final long RAW_TTL_HOURS = 6;

    private final EnrichedSolutionRepository enrichedRepo;
    private final ExplanationRepository legacyRepo;
    private final UserSolutionRepository solutionRepo;
    private final CrawledSolutionRepository crawledRepo;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;
    private final com.algorithm.help.content.enrichment.util.UrlWhitelistValidator urlWhitelistValidator;

    /**
     * 查询解析列表（enriched 优先，fallback legacy）
     */
    public UnifiedExplanationResponse getExplanations(String problemId, int level) {
        // 尝试读缓存
        String cacheKey = String.format(LIST_CACHE_KEY, problemId, level);
        UnifiedExplanationResponse cached = getFromCache(cacheKey, UnifiedExplanationResponse.class);
        if (cached != null) {
            return cached;
        }

        // 查询 enriched
        List<EnrichedSolution> enrichedList = enrichedRepo
                .findByProblemIdAndLevelAndStatusOrderBySortOrderAsc(problemId, level, EnrichedStatus.PUBLISHED);

        if (!enrichedList.isEmpty()) {
            List<EnrichedSummaryDTO> summaries = enrichedList.stream()
                    .map(this::toSummaryDTO)
                    .toList();
            UnifiedExplanationResponse response = UnifiedExplanationResponse.enriched(summaries);
            setCache(cacheKey, response, LIST_TTL_HOURS);
            return response;
        }

        // Fallback: 查询 legacy
        return legacyRepo.findByProblemIdAndLevelAndIsLatestTrue(problemId, level)
                .map(this::toLegacyResponse)
                .orElseGet(UnifiedExplanationResponse::empty);
    }

    /**
     * 获取单条详情（含 timeComplexity、spaceComplexity）
     */
    public EnrichedDetailDTO getDetail(String id) {
        String cacheKey = String.format(DETAIL_CACHE_KEY, id);
        EnrichedDetailDTO cached = getFromCache(cacheKey, EnrichedDetailDTO.class);
        if (cached != null) {
            return cached;
        }

        EnrichedSolution entity = enrichedRepo.findById(id).orElse(null);
        if (entity == null) {
            return null;
        }

        EnrichedDetailDTO dto = toDetailDTO(entity);
        setCache(cacheKey, dto, DETAIL_TTL_HOURS);
        return dto;
    }

    /**
     * 查询原始题解（分页 + 排序 + hasEnriched 标记）
     * 数据来源：crawled_solutions 表（Python 爬虫爬取的社区题解）
     */
    public PageResult<RawSolutionDTO> getRawSolutions(String problemId, RawSolutionQuery query) {
        Sort sort = buildRawSort(query.getSort());
        PageRequest pageable = PageRequest.of(query.getPage(), query.getSize(), sort);

        Page<CrawledSolution> page = crawledRepo.findByProblemId(problemId, pageable);
        List<RawSolutionDTO> dtos = mapCrawledSolutions(page.getContent(), problemId);
        return PageResult.of(dtos, page.getTotalElements(), query.getPage(), query.getSize());
    }

    /**
     * 标签聚合查询
     */
    public List<TagCount> getTagAggregation(String problemId, int level) {
        String cacheKey = String.format(TAGS_CACHE_KEY, problemId, level);
        List<TagCount> cached = getListFromCache(cacheKey);
        if (cached != null) {
            return cached;
        }

        List<EnrichedSolution> published = enrichedRepo
                .findByProblemIdAndLevelAndStatusOrderBySortOrderAsc(problemId, level, EnrichedStatus.PUBLISHED);

        Map<String, Integer> tagMap = new HashMap<>();
        for (EnrichedSolution es : published) {
            List<String> tags = parseTags(es.getTags());
            for (String tag : tags) {
                tagMap.merge(tag, 1, Integer::sum);
            }
        }

        List<TagCount> result = tagMap.entrySet().stream()
                .map(e -> new TagCount().setTag(e.getKey()).setCount(e.getValue()))
                .sorted(Comparator.comparingInt(TagCount::getCount).reversed())
                .toList();

        setCache(cacheKey, result, TAGS_TTL_HOURS);
        return result;
    }

    /**
     * 审核通过（设置 PUBLISHED）+ 乐观锁校验
     */
    public EnrichedDetailDTO approve(String id, int expectedVersion) {
        EnrichedSolution entity = findAndCheckVersion(id, expectedVersion);
        entity.setStatus(EnrichedStatus.PUBLISHED);
        enrichedRepo.save(entity);
        invalidateCache(entity.getProblemId(), entity.getLevel());
        return toDetailDTO(entity);
    }

    /**
     * 审核拒绝 + 乐观锁校验
     */
    public EnrichedDetailDTO reject(String id, int expectedVersion, String reason) {
        EnrichedSolution entity = findAndCheckVersion(id, expectedVersion);
        entity.setStatus(EnrichedStatus.REJECTED);
        enrichedRepo.save(entity);
        invalidateCache(entity.getProblemId(), entity.getLevel());
        return toDetailDTO(entity);
    }

    /**
     * 删除 enriched 记录
     */
    public void deleteEnriched(String id) {
        EnrichedSolution entity = enrichedRepo.findById(id).orElse(null);
        if (entity == null) {
            return;
        }
        enrichedRepo.delete(entity);
        invalidateCache(entity.getProblemId(), entity.getLevel());
        invalidateDetailCache(id);
    }

    /**
     * 获取待审核列表
     */
    public List<EnrichedSolution> getPendingReviewItems() {
        return enrichedRepo.findByStatusOrderByCreatedAtDesc(EnrichedStatus.PENDING_REVIEW);
    }

    /**
     * 保存 enriched 记录（入库前校验 source_url 白名单）
     *
     * @throws IllegalArgumentException 如果 source_url 域名不在白名单内
     */
    public EnrichedSolution saveEnriched(EnrichedSolution entity) {
        // URL 白名单校验
        if (!urlWhitelistValidator.isValid(entity.getSourceUrl())) {
            throw new IllegalArgumentException(
                    "source_url 域名不在白名单内: " + entity.getSourceUrl());
        }
        EnrichedSolution saved = enrichedRepo.save(entity);
        invalidateCache(saved.getProblemId(), saved.getLevel());
        return saved;
    }

    /**
     * 设置/取消推荐标记
     * <p>
     * 同题同级别最多 1 条推荐。设置新推荐时自动取消旧推荐。
     *
     * @param id          enriched 记录 ID
     * @param recommended 是否推荐
     * @return 更新后的详情 DTO
     */
    public EnrichedDetailDTO setRecommended(String id, boolean recommended) {
        EnrichedSolution entity = enrichedRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("enriched 记录不存在: " + id));

        if (recommended) {
            // 唯一性：取消同题同级别的已有推荐
            enrichedRepo.findByProblemIdAndLevelAndRecommendedTrue(entity.getProblemId(), entity.getLevel())
                    .ifPresent(existing -> {
                        if (!existing.getId().equals(id)) {
                            existing.setRecommended(false);
                            enrichedRepo.save(existing);
                        }
                    });
        }

        entity.setRecommended(recommended);
        enrichedRepo.save(entity);
        invalidateCache(entity.getProblemId(), entity.getLevel());
        invalidateDetailCache(id);
        return toDetailDTO(entity);
    }

    /**
     * 失效缓存（写操作后调用）
     */
    public void invalidateCache(String problemId, int level) {
        try {
            String listKey = String.format(LIST_CACHE_KEY, problemId, level);
            String tagsKey = String.format(TAGS_CACHE_KEY, problemId, level);
            redisTemplate.delete(List.of(listKey, tagsKey));
        } catch (Exception e) {
            log.warn("缓存失效失败, problemId={}, level={}: {}", problemId, level, e.getMessage());
        }
    }

    /**
     * 失效详情缓存
     */
    public void invalidateDetailCache(String id) {
        try {
            String key = String.format(DETAIL_CACHE_KEY, id);
            redisTemplate.delete(key);
        } catch (Exception e) {
            log.warn("详情缓存失效失败, id={}: {}", id, e.getMessage());
        }
    }

    // ===== 私有方法 =====

    private EnrichedSolution findAndCheckVersion(String id, int expectedVersion) {
        EnrichedSolution entity = enrichedRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("enriched 记录不存在: " + id));
        if (!entity.getVersion().equals(expectedVersion)) {
            throw new OptimisticLockConflictException("版本冲突，当前版本=" + entity.getVersion()
                    + "，期望版本=" + expectedVersion);
        }
        return entity;
    }

    private Sort buildRawSort(String sort) {
        if ("time".equalsIgnoreCase(sort)) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        return Sort.by(Sort.Direction.DESC, "voteCount");
    }

    private List<RawSolutionDTO> mapCrawledSolutions(List<CrawledSolution> solutions, String problemId) {
        // 批量查询哪些原始题解已有 enriched 记录
        Set<String> enrichedSourceIds = enrichedRepo
                .findByProblemIdAndLevelAndStatusOrderBySortOrderAsc(problemId, 3, EnrichedStatus.PUBLISHED)
                .stream()
                .map(EnrichedSolution::getSourceSolutionId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        return solutions.stream()
                .map(s -> toCrawledDTO(s, enrichedSourceIds.contains(s.getId())))
                .toList();
    }

    private RawSolutionDTO toCrawledDTO(CrawledSolution s, boolean hasEnriched) {
        return new RawSolutionDTO()
                .setId(s.getId())
                .setProblemId(s.getProblemId())
                .setTitle(s.getTitle())
                .setContent(s.getContent())
                .setLanguage(null)
                .setAuthorName(s.getAuthor())
                .setUpvotes(s.getVoteCount() != null ? s.getVoteCount() : 0)
                .setSourceUrl(null)
                .setSourceType(s.getSource())
                .setViewCount(s.getViewCount() != null ? s.getViewCount() : 0)
                .setCreatedAt(s.getCreatedAt())
                .setHasEnriched(hasEnriched);
    }

    private EnrichedSummaryDTO toSummaryDTO(EnrichedSolution e) {
        return new EnrichedSummaryDTO()
                .setId(e.getId())
                .setProblemId(e.getProblemId())
                .setLevel(e.getLevel())
                .setSourceType(e.getSourceType())
                .setSourceAuthor(e.getSourceAuthor())
                .setSourceVotes(e.getSourceVotes())
                .setTitle(e.getTitle())
                .setSummary(e.getSummary())
                .setTags(e.getTags())
                .setTimeComplexity(e.getTimeComplexity())
                .setSpaceComplexity(e.getSpaceComplexity())
                .setQualityScore(e.getQualityScore())
                .setVersion(e.getVersion())
                .setRecommended(e.getRecommended())
                .setStatus(e.getStatus())
                .setUpvoteCount(e.getUpvoteCount())
                .setDownvoteCount(e.getDownvoteCount())
                .setViewCount(e.getViewCount())
                .setCreatedAt(e.getCreatedAt())
                .setUpdatedAt(e.getUpdatedAt());
    }

    private EnrichedDetailDTO toDetailDTO(EnrichedSolution e) {
        return new EnrichedDetailDTO()
                .setId(e.getId())
                .setProblemId(e.getProblemId())
                .setLevel(e.getLevel())
                .setSourceType(e.getSourceType())
                .setSourceAuthor(e.getSourceAuthor())
                .setSourceUrl(e.getSourceUrl())
                .setSourceVotes(e.getSourceVotes())
                .setTitle(e.getTitle())
                .setSummary(e.getSummary())
                .setContent(e.getContent())
                .setCodeImplementations(e.getCodeImplementations())
                .setTags(e.getTags())
                .setTimeComplexity(e.getTimeComplexity())
                .setSpaceComplexity(e.getSpaceComplexity())
                .setAiProvider(e.getAiProvider())
                .setProcessingSteps(e.getProcessingSteps())
                .setQualityScore(e.getQualityScore())
                .setVersion(e.getVersion())
                .setRecommended(e.getRecommended())
                .setStatus(e.getStatus())
                .setUpvoteCount(e.getUpvoteCount())
                .setDownvoteCount(e.getDownvoteCount())
                .setViewCount(e.getViewCount())
                .setFeedbackCount(e.getFeedbackCount())
                .setCreatedAt(e.getCreatedAt())
                .setUpdatedAt(e.getUpdatedAt());
    }

    private UnifiedExplanationResponse toLegacyResponse(Explanation legacy) {
        LegacyExplanationDTO dto = new LegacyExplanationDTO()
                .setId(legacy.getId())
                .setProblemId(legacy.getProblemId())
                .setLevel(legacy.getLevel())
                .setSections(legacy.getSections())
                .setVersion(legacy.getVersion())
                .setCreatedAt(legacy.getCreatedAt());
        UnifiedExplanationResponse response = UnifiedExplanationResponse.legacy(dto);
        // legacy 不做长时间缓存
        return response;
    }

    private List<String> parseTags(String tagsJson) {
        if (tagsJson == null || tagsJson.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(tagsJson, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("解析 tags JSON 失败: {}", tagsJson);
            return Collections.emptyList();
        }
    }

    // ===== Redis 缓存辅助 =====

    @SuppressWarnings("unchecked")
    private <T> T getFromCache(String key, Class<T> type) {
        try {
            Object value = redisTemplate.opsForValue().get(key);
            if (value == null) {
                return null;
            }
            if (type.isInstance(value)) {
                return (T) value;
            }
            // JSON 反序列化兜底
            String json = objectMapper.writeValueAsString(value);
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            log.debug("读缓存失败, key={}: {}", key, e.getMessage());
            return null; // 降级查 DB
        }
    }

    @SuppressWarnings("unchecked")
    private List<TagCount> getListFromCache(String key) {
        try {
            Object value = redisTemplate.opsForValue().get(key);
            if (value == null) {
                return null;
            }
            String json = objectMapper.writeValueAsString(value);
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.debug("读缓存失败, key={}: {}", key, e.getMessage());
            return null;
        }
    }

    private void setCache(String key, Object value, long ttlHours) {
        try {
            redisTemplate.opsForValue().set(key, value, ttlHours, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("写缓存失败, key={}: {}", key, e.getMessage());
        }
    }

    /**
     * 乐观锁冲突异常
     */
    public static class OptimisticLockConflictException extends RuntimeException {
        public OptimisticLockConflictException(String message) {
            super(message);
        }
    }
}
