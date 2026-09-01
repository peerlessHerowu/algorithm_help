package com.algorithm.help.interactive.achievement;

/**
 * 成就类型枚举（含阶梯式成就）
 */
public enum AchievementType {

    // 基础成就
    FIRST_PROBLEM("初出茅庐", "完成第一道题"),
    PATTERN_MASTER("模式大师", "掌握 10 种算法模式"),

    // 连续学习阶梯
    STREAK_7("一周坚持", "连续学习 7 天"),
    STREAK_30("月度坚持", "连续学习 30 天"),
    STREAK_100("百日征途", "连续学习 100 天"),
    STREAK_365("年度传奇", "连续学习 365 天"),

    // 费曼学习阶梯
    FEYNMAN_SCHOLAR_5("费曼入门", "完成 5 次费曼学习"),
    FEYNMAN_SCHOLAR_20("费曼进阶", "完成 20 次费曼学习"),
    FEYNMAN_SCHOLAR_50("费曼精通", "完成 50 次费曼学习"),
    FEYNMAN_SCHOLAR_100("费曼大师", "完成 100 次费曼学习"),

    // 专项成就
    INTERVIEW_PRO("面试达人", "面试模拟得分 90+"),
    BUG_HUNTER("Bug 猎手", "Debug 训练连续 10 次全部找到"),
    SPEED_DEMON("极速解题", "30 秒内完成复习题"),
    COMPLEXITY_MASTER("复杂度直觉", "复杂度训练正确率 > 90% 且次数 > 50");

    private final String displayName;
    private final String description;

    AchievementType(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
}
