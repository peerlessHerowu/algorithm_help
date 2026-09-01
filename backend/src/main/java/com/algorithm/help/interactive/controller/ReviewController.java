package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.review.CardType;
import com.algorithm.help.interactive.review.SpacedRepetitionCard;
import com.algorithm.help.interactive.review.SpacedRepetitionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 间隔重复复习 REST API
 */
@RestController
@RequestMapping("/api/v1/review")
@RequiredArgsConstructor
public class ReviewController {

    private final SpacedRepetitionService reviewService;

    /**
     * 获取今日待复习列表
     */
    @GetMapping("/today")
    public ApiResponse<List<SpacedRepetitionCard>> todayReviews(@RequestParam String userId) {
        return ApiResponse.success(reviewService.getTodayReviews(userId));
    }

    /**
     * 记录复习结果（SM-2 算法更新）
     * quality: 1=忘了，3=模糊，4=记得，5=秒杀
     */
    @PostMapping("/record")
    public ApiResponse<SpacedRepetitionCard> recordReview(@RequestBody RecordRequest request) {
        SpacedRepetitionCard card = reviewService.recordReview(
                request.getCardId(), request.getQuality());
        return ApiResponse.success(card);
    }

    /**
     * 手动创建复习卡片
     */
    @PostMapping("/cards")
    public ApiResponse<SpacedRepetitionCard> createCard(@RequestBody CreateCardRequest request) {
        SpacedRepetitionCard card = reviewService.createCard(
                request.getUserId(), request.getProblemId(), request.getCardType());
        return ApiResponse.success(card);
    }

    /**
     * 获取用户所有复习卡片
     */
    @GetMapping("/cards")
    public ApiResponse<List<SpacedRepetitionCard>> allCards(@RequestParam String userId) {
        return ApiResponse.success(reviewService.getAllCards(userId));
    }

    /**
     * 获取今日学习统计（复习完成情况）
     */
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats(@RequestParam String userId) {
        return ApiResponse.success(reviewService.getDailyStats(userId));
    }

    @Data
    public static class RecordRequest {
        private String cardId;
        /** 自评分：1/3/4/5（对应忘了/模糊/记得/秒杀） */
        private int quality;
    }

    @Data
    public static class CreateCardRequest {
        private String userId;
        private String problemId;
        private CardType cardType;
    }
}
