class Purchase {
  Purchase({
    required this.id,
    this.productName,
    this.productCode,
    this.amount,
    this.netAmount,
    this.pointsEarned,
    this.pointsRedeemed,
    this.status,
    this.branchName,
    this.voucherNumber,
    this.soldAt,
    this.paymentMethod,
    this.raw,
  });

  final int id;
  final String? productName;
  final String? productCode;
  final num? amount;
  final num? netAmount;
  final num? pointsEarned;
  final num? pointsRedeemed;
  final String? status;
  final String? branchName;
  final String? voucherNumber;
  final String? soldAt;
  final String? paymentMethod;
  final Map<String, dynamic>? raw;

  factory Purchase.fromJson(Map<String, dynamic> json) => Purchase(
        id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
        productName: json['product_name']?.toString() ?? json['item_name']?.toString(),
        productCode: json['product_code']?.toString(),
        amount: json['amount'] is num ? json['amount'] as num : num.tryParse('${json['amount']}'),
        netAmount: json['net_amount'] is num
            ? json['net_amount'] as num
            : num.tryParse('${json['net_amount']}'),
        pointsEarned: json['points_earned'] is num ? json['points_earned'] as num : null,
        pointsRedeemed: json['points_redeemed'] is num ? json['points_redeemed'] as num : null,
        status: json['status']?.toString(),
        branchName: json['branch_name']?.toString() ?? json['branch']?.toString(),
        voucherNumber: json['voucher_number']?.toString(),
        soldAt: json['sold_at']?.toString() ?? json['created_at']?.toString(),
        paymentMethod: json['payment_method']?.toString(),
        raw: json,
      );
}

class LedgerEntry {
  LedgerEntry({
    required this.id,
    required this.type,
    required this.points,
    this.source,
    this.createdAt,
    this.meta,
  });

  final int id;
  final String type;
  final num points;
  final String? source;
  final String? createdAt;
  final Map<String, dynamic>? meta;

  factory LedgerEntry.fromJson(Map<String, dynamic> json) => LedgerEntry(
        id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
        type: '${json['type'] ?? ''}',
        points: json['points'] is num ? json['points'] as num : num.tryParse('${json['points']}') ?? 0,
        source: json['source']?.toString(),
        createdAt: json['created_at']?.toString(),
        meta: json['meta'] is Map<String, dynamic> ? json['meta'] as Map<String, dynamic> : null,
      );
}

class RewardItem {
  RewardItem({
    required this.id,
    required this.name,
    required this.pointsCost,
    this.description,
    this.imageUrl,
    this.category,
    this.fulfillment = 'pickup',
    this.stock,
  });

  final int id;
  final String name;
  final num pointsCost;
  final String? description;
  final String? imageUrl;
  final String? category;
  final String fulfillment;
  final int? stock;

  bool get isInstant =>
      fulfillment == 'instant' || (fulfillment.isEmpty && category == 'partner');

  factory RewardItem.fromJson(Map<String, dynamic> json) => RewardItem(
        id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
        name: '${json['name'] ?? ''}',
        pointsCost: json['points_cost'] is num
            ? json['points_cost'] as num
            : num.tryParse('${json['points_cost']}') ?? 0,
        description: json['description']?.toString(),
        imageUrl: json['image_url']?.toString() ?? json['image']?.toString(),
        category: json['category']?.toString(),
        fulfillment: '${json['fulfillment'] ?? (json['category'] == 'partner' ? 'instant' : 'pickup')}',
        stock: json['stock'] is int ? json['stock'] as int : int.tryParse('${json['stock']}'),
      );
}

class Redemption {
  Redemption({
    required this.id,
    this.redemptionCode,
    this.status,
    this.rewardItem,
    this.createdAt,
  });

  final int id;
  final String? redemptionCode;
  final String? status;
  final RewardItem? rewardItem;
  final String? createdAt;

  bool get canCancel => status == 'pending';

  factory Redemption.fromJson(Map<String, dynamic> json) => Redemption(
        id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
        redemptionCode: json['redemption_code']?.toString(),
        status: json['status']?.toString(),
        rewardItem: json['reward_item'] is Map<String, dynamic>
            ? RewardItem.fromJson(json['reward_item'] as Map<String, dynamic>)
            : null,
        createdAt: json['created_at']?.toString(),
      );
}

class Mission {
  Mission({
    required this.id,
    required this.title,
    this.description,
    this.goalTarget = 0,
    this.progress = 0,
    this.bonusPoints = 0,
    this.status = 'in_progress',
    this.goalType,
  });

  final int id;
  final String title;
  final String? description;
  final num goalTarget;
  final num progress;
  final num bonusPoints;
  final String status;
  final String? goalType;

  double get progressRatio {
    if (goalTarget <= 0) return 0;
    return (progress / goalTarget).clamp(0, 1).toDouble();
  }

  factory Mission.fromJson(Map<String, dynamic> json) {
    final progressMap = json['progress'];
    num progressValue = 0;
    String status = '${json['status'] ?? 'in_progress'}';
    if (progressMap is Map) {
      progressValue = progressMap['current'] is num
          ? progressMap['current'] as num
          : num.tryParse('${progressMap['current']}') ?? 0;
      status = '${progressMap['status'] ?? status}';
    } else if (json['user_progress'] is Map) {
      final up = json['user_progress'] as Map;
      progressValue = up['progress'] is num ? up['progress'] as num : 0;
      status = '${up['status'] ?? status}';
    } else {
      progressValue = json['current_progress'] is num ? json['current_progress'] as num : 0;
    }
    return Mission(
      id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
      title: '${json['title'] ?? json['name'] ?? ''}',
      description: json['description']?.toString(),
      goalTarget: json['goal_target'] is num ? json['goal_target'] as num : 0,
      progress: progressValue,
      bonusPoints: json['bonus_points'] is num ? json['bonus_points'] as num : 0,
      status: status,
      goalType: json['goal_type']?.toString(),
    );
  }
}

class ProductReview {
  ProductReview({
    required this.id,
    required this.productCode,
    this.productName,
    this.rating = 5,
    this.body,
    this.pointsAwarded,
    this.createdAt,
  });

  final int id;
  final String productCode;
  final String? productName;
  final int rating;
  final String? body;
  final num? pointsAwarded;
  final String? createdAt;

  factory ProductReview.fromJson(Map<String, dynamic> json) => ProductReview(
        id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
        productCode: '${json['product_code'] ?? ''}',
        productName: json['product_name']?.toString(),
        rating: json['rating'] is int ? json['rating'] as int : int.tryParse('${json['rating']}') ?? 5,
        body: json['body']?.toString() ?? json['comment']?.toString(),
        pointsAwarded: json['points_awarded'] is num ? json['points_awarded'] as num : null,
        createdAt: json['created_at']?.toString(),
      );
}

class AppNotification {
  AppNotification({
    required this.id,
    required this.title,
    this.body,
    this.type,
    this.readAt,
    this.createdAt,
    this.data,
  });

  final int id;
  final String title;
  final String? body;
  final String? type;
  final String? readAt;
  final String? createdAt;
  final Map<String, dynamic>? data;

  bool get isUnread => readAt == null || readAt!.isEmpty;

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
        title: '${json['title'] ?? ''}',
        body: json['body']?.toString() ?? json['message']?.toString(),
        type: json['type']?.toString(),
        readAt: json['read_at']?.toString(),
        createdAt: json['created_at']?.toString(),
        data: json['data'] is Map<String, dynamic> ? json['data'] as Map<String, dynamic> : null,
      );
}

class FaqItem {
  FaqItem({required this.id, required this.question, required this.answer});

  final int id;
  final String question;
  final String answer;

  factory FaqItem.fromJson(Map<String, dynamic> json, {String lang = 'en'}) {
    final q = lang == 'my'
        ? (json['question_my'] ?? json['question'] ?? '')
        : (json['question'] ?? json['question_en'] ?? '');
    final a = lang == 'my'
        ? (json['answer_my'] ?? json['answer'] ?? '')
        : (json['answer'] ?? json['answer_en'] ?? '');
    return FaqItem(
      id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
      question: '$q',
      answer: '$a',
    );
  }
}

class FeedbackThread {
  FeedbackThread({
    required this.id,
    required this.subject,
    this.message,
    this.status,
    this.replies = const [],
    this.createdAt,
  });

  final int id;
  final String subject;
  final String? message;
  final String? status;
  final List<FeedbackReply> replies;
  final String? createdAt;

  factory FeedbackThread.fromJson(Map<String, dynamic> json) => FeedbackThread(
        id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
        subject: '${json['subject'] ?? ''}',
        message: json['message']?.toString() ?? json['body']?.toString(),
        status: json['status']?.toString(),
        createdAt: json['created_at']?.toString(),
        replies: (json['replies'] as List? ?? [])
            .whereType<Map>()
            .map((e) => FeedbackReply.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

class FeedbackReply {
  FeedbackReply({required this.id, required this.body, this.createdAt, this.isStaff = false});

  final int id;
  final String body;
  final String? createdAt;
  final bool isStaff;

  factory FeedbackReply.fromJson(Map<String, dynamic> json) => FeedbackReply(
        id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
        body: '${json['body'] ?? json['message'] ?? ''}',
        createdAt: json['created_at']?.toString(),
        isStaff: json['is_staff'] == true || json['from_staff'] == true,
      );
}

class AppBranding {
  AppBranding({
    this.appName = '29 Jewellery',
    this.appTagline = 'GEMS & JEWELLERY',
    this.appLogo,
  });

  final String appName;
  final String appTagline;
  final String? appLogo;

  factory AppBranding.fromJson(Map<String, dynamic> json) => AppBranding(
        appName: '${json['app_name'] ?? '29 Jewellery'}',
        appTagline: '${json['app_tagline'] ?? 'GEMS & JEWELLERY'}',
        appLogo: json['app_logo_url']?.toString() ?? json['app_logo']?.toString(),
      );
}

class SpinSegment {
  SpinSegment({
    required this.index,
    required this.label,
    this.color,
    this.imageUrl,
    this.description,
  });

  final int index;
  final String label;
  final String? color;
  final String? imageUrl;
  final String? description;

  factory SpinSegment.fromJson(Map<String, dynamic> json, int index) => SpinSegment(
        index: json['index'] is int ? json['index'] as int : index,
        label:
            '${json['display_label'] ?? json['prize_label'] ?? json['label'] ?? json['name'] ?? json['prize_name'] ?? ''}',
        color: json['color']?.toString(),
        imageUrl: json['image_url']?.toString() ??
            (json['image_path'] != null ? '/storage/${json['image_path']}' : null),
        description: json['description']?.toString(),
      );
}

class SpinReward {
  SpinReward({
    required this.id,
    this.rewardCode,
    this.prizeName,
    this.displayStatus,
    this.statusLabel,
    this.claimDeadlineAt,
    this.createdAt,
    this.description,
    this.instructions,
    this.winningMessage,
    this.imageUrl,
    this.tier,
    this.requiresClaim = true,
  });

  final int id;
  final String? rewardCode;
  final String? prizeName;
  final String? displayStatus;
  final String? statusLabel;
  final String? claimDeadlineAt;
  final String? createdAt;
  final String? description;
  final String? instructions;
  final String? winningMessage;
  final String? imageUrl;
  final String? tier;
  final bool requiresClaim;

  bool get isMajor => tier == 'major';
  bool get readyToCollect => displayStatus == 'ready_to_collect';

  factory SpinReward.fromJson(Map<String, dynamic> json) => SpinReward(
        id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
        rewardCode: json['reward_code']?.toString() ?? json['code']?.toString(),
        prizeName: json['prize_label']?.toString() ??
            json['prize_name']?.toString() ??
            json['display_label']?.toString() ??
            json['label']?.toString() ??
            json['name']?.toString(),
        displayStatus: json['display_status']?.toString() ?? json['claim_status']?.toString(),
        statusLabel: json['status_label']?.toString(),
        claimDeadlineAt: json['claim_deadline_at']?.toString(),
        createdAt: json['created_at']?.toString(),
        description: json['description']?.toString(),
        instructions: json['instructions']?.toString(),
        winningMessage: json['winning_message']?.toString(),
        imageUrl: json['image_url']?.toString() ??
            (json['image_path'] != null ? '/storage/${json['image_path']}' : null),
        tier: json['tier']?.toString(),
        requiresClaim: json['requires_claim'] != false,
      );
}

class SpinPromo {
  SpinPromo({
    required this.id,
    this.title,
    this.message,
    this.spinCount = 1,
  });

  final int id;
  final String? title;
  final String? message;
  final int spinCount;

  factory SpinPromo.fromJson(Map<String, dynamic> json) => SpinPromo(
        id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
        title: json['title']?.toString(),
        message: json['message']?.toString() ?? json['body']?.toString(),
        spinCount: json['spin_count'] is int
            ? json['spin_count'] as int
            : int.tryParse('${json['spin_count']}') ?? 1,
      );
}

class SpinState {
  SpinState({
    this.spinsRemaining = 0,
    this.segments = const [],
    this.rewards = const [],
    this.pendingPromo,
    this.hasPendingPromo = false,
    this.wheelRevision,
    this.wheelTitle,
    this.wheelSubtitle,
    this.helpText,
    this.brandTitle,
    this.logoUrl,
    this.expiryGroups = const [],
  });

  final int spinsRemaining;
  final List<SpinSegment> segments;
  final List<SpinReward> rewards;
  final SpinPromo? pendingPromo;
  final bool hasPendingPromo;
  final String? wheelRevision;
  final String? wheelTitle;
  final String? wheelSubtitle;
  final String? helpText;
  final String? brandTitle;
  final String? logoUrl;
  final List<Map<String, dynamic>> expiryGroups;

  factory SpinState.fromJson(Map<String, dynamic> json) {
    final wheel = json['wheel'] is Map ? Map<String, dynamic>.from(json['wheel'] as Map) : <String, dynamic>{};
    final segs = (wheel['segments'] as List? ?? json['segments'] as List? ?? [])
        .asMap()
        .entries
        .where((e) => e.value is Map)
        .map((e) => SpinSegment.fromJson(Map<String, dynamic>.from(e.value as Map), e.key))
        .toList();
    final rewardsRaw = json['rewards'];
    List rewardsList = [];
    if (rewardsRaw is List) {
      rewardsList = rewardsRaw;
    } else if (rewardsRaw is Map && rewardsRaw['data'] is List) {
      rewardsList = rewardsRaw['data'] as List;
    }
    final groups = (json['expiry_groups'] as List? ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    return SpinState(
      spinsRemaining: json['spins_remaining'] is int
          ? json['spins_remaining'] as int
          : int.tryParse('${json['spins_remaining'] ?? json['credits']}') ?? 0,
      segments: segs,
      rewards: rewardsList
          .whereType<Map>()
          .map((e) => SpinReward.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      pendingPromo: json['pending_promo'] is Map
          ? SpinPromo.fromJson(Map<String, dynamic>.from(json['pending_promo'] as Map))
          : null,
      hasPendingPromo: json['has_pending_promo'] == true || json['pending_promo'] != null,
      wheelRevision: json['revision']?.toString() ?? wheel['revision']?.toString(),
      wheelTitle: '${wheel['page_title'] ?? wheel['name'] ?? ''}'.trim().isEmpty
          ? null
          : '${wheel['page_title'] ?? wheel['name']}',
      wheelSubtitle: wheel['subtitle']?.toString(),
      helpText: wheel['help_text']?.toString(),
      brandTitle: wheel['brand_title']?.toString() ?? wheel['name']?.toString(),
      logoUrl: wheel['logo_url']?.toString() ??
          (wheel['logo_path'] != null ? '/storage/${wheel['logo_path']}' : null),
      expiryGroups: groups,
    );
  }
}

List<T> parseList<T>(dynamic raw, T Function(Map<String, dynamic>) map) {
  if (raw is List) {
    return raw.whereType<Map>().map((e) => map(Map<String, dynamic>.from(e))).toList();
  }
  if (raw is Map && raw['data'] is List) {
    return (raw['data'] as List)
        .whereType<Map>()
        .map((e) => map(Map<String, dynamic>.from(e)))
        .toList();
  }
  return [];
}
