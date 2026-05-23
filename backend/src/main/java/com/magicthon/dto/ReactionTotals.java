package com.magicthon.dto;

import java.util.Map;

public record ReactionTotals(String slug, Map<String, Long> counts, long total) {}
