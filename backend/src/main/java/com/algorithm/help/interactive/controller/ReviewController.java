package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.review.CardType;
import com.algorithm.help.interactive.review.SpacedRepetitionCard;
import com.algorithm.help.interactive.review.SpacedRepetitionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
     * 记录复习结果
     */
    @PostMapping("/record")
    public ApiResponse<SpacedRepetitionCard> recordReview(@RequestBody RecordRequest request) {
        SpacedRepetitionCard card = reviewService.recordReview(request.getCardId(), request.getQuality());
        return ApiResponse.success(card);
    }

    /**
     * 创建复习卡片
     */
    @PostMapping("/card")
    public ApiResponse<SpacedRepetitionCard> createCard(@RequestBody CreateCardRequest request) {
        SpacedRepetitionCard card = reviewService.createCard(
                request.getUserId(), request.getProblemId(), request.getCardType());
        return ApiResponse.success(card);
    }

    @Data
    public static class RecordRequest {
        private String cardId;
        /** 自评分 0-5 */
        private int quality;
    }

    @Data
    public static class CreateCardRequest {
        private String userId;
        private String problemId;
        private CardType cardType;
    }
}
