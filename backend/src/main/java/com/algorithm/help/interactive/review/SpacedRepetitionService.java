package com.algorithm.help.interactive.review;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * 间隔重复服务：SM-2 算法核心实现
 * <p>
 * SM-2 公式：
 * - quality >= 3: interval = 1→6→interval×EF
 * - quality < 3: interval = 1, repetitions = 0
 * - EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)), 最小 1.3
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpacedRepetitionService {

    private static final double MIN_EF = 1.3;

    private final SpacedRepetitionRepository cardRepo;

    /**
     * 创建新卡片（初始 EF=2.5）
     */
    public SpacedRepetitionCard createCard(String userId, String problemId, CardType type) {
        // 检查是否已存在
        Optional<SpacedRepetitionCard> existing = cardRepo
                .findByUserIdAndProblemIdAndCardType(userId, problemId, type);
        if (existing.isPresent()) {
            return existing.get();
        }
        SpacedRepetitionCard card = new SpacedRepetitionCard()
                .setUserId(userId)
                .setProblemId(problemId)
                .setCardType(type)
                .setEaseFactor(2.5)
                .setIntervalDays(0)
                .setRepetitions(0)
                .setNextReviewAt(System.currentTimeMillis());
        return cardRepo.save(card);
    }

    /**
     * 更新卡片 metadata
     */
    public void updateCardMetadata(String cardId, String metadata) {
        cardRepo.findById(cardId).ifPresent(card -> {
            card.setMetadata(metadata);
            cardRepo.save(card);
        });
    }

    /**
     * 获取用户所有卡片
     */
    public List<SpacedRepetitionCard> getAllCards(String userId) {
        return cardRepo.findByUserId(userId);
    }

    /**
     * 获取今日学习统计
     */
    public java.util.Map<String, Object> getDailyStats(String userId) {
        List<SpacedRepetitionCard> all = cardRepo.findByUserId(userId);
        long todayDue = all.stream()
                .filter(c -> c.getNextReviewAt() != null
                        && c.getNextReviewAt() <= System.currentTimeMillis())
                .count();
        long mastered = all.stream()
                .filter(c -> c.getRepetitions() >= 3)
                .count();
        return java.util.Map.of(
                "todayDue", todayDue,
                "total", all.size(),
                "mastered", mastered,
                "masteryRate", all.isEmpty() ? 0.0 : (double) mastered / all.size() * 100
        );
    }

    /**
     * 记录复习结果，执行 SM-2 计算
     *
     * @param cardId  卡片 ID
     * @param quality 自评分（0-5）
     */
    public SpacedRepetitionCard recordReview(String cardId, int quality) {
        SpacedRepetitionCard card = cardRepo.findById(cardId)
                .orElseThrow(() -> new RuntimeException("卡片不存在: " + cardId));

        // 更新 EF
        double newEF = calculateNewEF(card.getEaseFactor(), quality);
        card.setEaseFactor(newEF);

        // 更新间隔和重复次数
        if (quality >= 3) {
            updateForCorrect(card);
        } else {
            resetForIncorrect(card);
        }

        // 计算下次复习时间
        long nextReview = System.currentTimeMillis() + TimeUnit.DAYS.toMillis(card.getIntervalDays());
        card.setNextReviewAt(nextReview);
        card.setLastReviewAt(System.currentTimeMillis());

        log.debug("SM-2 计算完成: cardId={}, quality={}, EF={}, interval={}天",
                cardId, quality, String.format("%.2f", newEF), card.getIntervalDays());
        return cardRepo.save(card);
    }

    /**
     * 获取今日待复习卡片
     */
    public List<SpacedRepetitionCard> getTodayReviews(String userId) {
        return cardRepo.findByUserIdAndNextReviewAtBefore(userId, System.currentTimeMillis());
    }

    /**
     * SM-2 EF 更新公式
     */
    private double calculateNewEF(double currentEF, int quality) {
        double newEF = currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        return Math.max(MIN_EF, newEF);
    }

    /**
     * 回答正确：间隔递增
     */
    private void updateForCorrect(SpacedRepetitionCard card) {
        int reps = card.getRepetitions() + 1;
        card.setRepetitions(reps);
        if (reps == 1) {
            card.setIntervalDays(1);
        } else if (reps == 2) {
            card.setIntervalDays(6);
        } else {
            int newInterval = (int) Math.round(card.getIntervalDays() * card.getEaseFactor());
            card.setIntervalDays(newInterval);
        }
    }

    /**
     * 回答错误：间隔重置
     */
    private void resetForIncorrect(SpacedRepetitionCard card) {
        card.setRepetitions(0);
        card.setIntervalDays(1);
    }
}
