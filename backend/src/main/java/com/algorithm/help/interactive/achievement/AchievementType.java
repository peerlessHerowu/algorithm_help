package com.algorithm.help.interactive.achievement;

/**
 * 成就类型枚举
 * <p>
 * 包含阶梯式成就（连续学习、费曼学习）和专项成就。
 * 每个成就附带展示名、描述、解锁条件说明。
 *
 * @author algorithm-help
 * @since 1.0.0
 */
public enum AchievementType {

    // ===== 基础成就 =====
    FIRST_PROBLEM("初出茅庐", "完成第一次交互式学习", "完成任意 1 次费曼/苏格拉底/Debug 会话"),
    PATTERN_MASTER("模式大师", "掌握 10 种算法模式", "在复习系统中掌握 10 种不同的算法模式"),

    // ===== 连续学习阶梯 =====
    STREAK_7("一周坚持", "连续学习 7 天", "连续 7 天完成至少 1 次学习会话"),
    STREAK_30("月度坚持", "连续学习 30 天", "连续 30 天完成至少 1 次学习会话"),
    STREAK_100("百日征途", "连续学习 100 天", "连续 100 天完成至少 1 次学习会话"),
    STREAK_365("年度传奇", "连续学习 365 天", "连续 365 天完成至少 1 次学习会话"),

    // ===== 费曼学习阶梯 =====
    FEYNMAN_SCHOLAR_5("费曼入门", "完成 5 次费曼学习", "累计完成 5 次费曼学习会话"),
    FEYNMAN_SCHOLAR_20("费曼进阶", "完成 20 次费曼学习", "累计完成 20 次费曼学习会话"),
    FEYNMAN_SCHOLAR_50("费曼精通", "完成 50 次费曼学习", "累计完成 50 次费曼学习会话"),
    FEYNMAN_SCHOLAR_100("费曼大师", "完成 100 次费曼学习", "累计完成 100 次费曼学习会话"),

    // ===== 专项成就 =====
    INTERVIEW_PRO("面试达人", "面试模拟总分 90+", "在面试模拟中获得 90 分以上"),
    BUG_HUNTER("Bug 猎手", "Debug 训练连续 10 次全部找到", "连续 10 次 Debug 训练均成功找到所有 Bug"),
    SPEED_DEMON("极速解题", "30 秒内完成复习题", "在 30 秒内翻卡并记录复习结果"),
    COMPLEXITY_MASTER("复杂度直觉", "复杂度训练正确率 90%+（次数 ≥ 50）", "完成 50 次以上复杂度训练且正确率达 90%");

    private final String displayName;
    private final String description;
    private final String unlockCondition;

    AchievementType(String displayName, String description, String unlockCondition) {
        this.displayName = displayName;
        this.description = description;
        this.unlockCondition = unlockCondition;
    }

    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
    public String getUnlockCondition() { return unlockCondition; }
}
