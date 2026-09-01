package com.algorithm.help.interactive.review;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 间隔重复卡片 Repository
 */
public interface SpacedRepetitionRepository extends JpaRepository<SpacedRepetitionCard, String> {

    List<SpacedRepetitionCard> findByUserIdAndNextReviewAtBefore(String userId, Long timestamp);

    List<SpacedRepetitionCard> findByUserId(String userId);

    Optional<SpacedRepetitionCard> findByUserIdAndProblemIdAndCardType(
            String userId, String problemId, CardType cardType);
}
