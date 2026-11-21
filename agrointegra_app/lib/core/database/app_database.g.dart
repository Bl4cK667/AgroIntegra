// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $AppMetaTable extends AppMeta with TableInfo<$AppMetaTable, AppMetaData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $AppMetaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
    'value',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [key, value];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'app_meta';
  @override
  VerificationContext validateIntegrity(
    Insertable<AppMetaData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
        _keyMeta,
        key.isAcceptableOrUnknown(data['key']!, _keyMeta),
      );
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('value')) {
      context.handle(
        _valueMeta,
        value.isAcceptableOrUnknown(data['value']!, _valueMeta),
      );
    } else if (isInserting) {
      context.missing(_valueMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  AppMetaData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return AppMetaData(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      value: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}value'],
      )!,
    );
  }

  @override
  $AppMetaTable createAlias(String alias) {
    return $AppMetaTable(attachedDatabase, alias);
  }
}

class AppMetaData extends DataClass implements Insertable<AppMetaData> {
  final String key;
  final String value;
  const AppMetaData({required this.key, required this.value});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['value'] = Variable<String>(value);
    return map;
  }

  AppMetaCompanion toCompanion(bool nullToAbsent) {
    return AppMetaCompanion(key: Value(key), value: Value(value));
  }

  factory AppMetaData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return AppMetaData(
      key: serializer.fromJson<String>(json['key']),
      value: serializer.fromJson<String>(json['value']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'value': serializer.toJson<String>(value),
    };
  }

  AppMetaData copyWith({String? key, String? value}) =>
      AppMetaData(key: key ?? this.key, value: value ?? this.value);
  AppMetaData copyWithCompanion(AppMetaCompanion data) {
    return AppMetaData(
      key: data.key.present ? data.key.value : this.key,
      value: data.value.present ? data.value.value : this.value,
    );
  }

  @override
  String toString() {
    return (StringBuffer('AppMetaData(')
          ..write('key: $key, ')
          ..write('value: $value')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, value);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AppMetaData &&
          other.key == this.key &&
          other.value == this.value);
}

class AppMetaCompanion extends UpdateCompanion<AppMetaData> {
  final Value<String> key;
  final Value<String> value;
  final Value<int> rowid;
  const AppMetaCompanion({
    this.key = const Value.absent(),
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  AppMetaCompanion.insert({
    required String key,
    required String value,
    this.rowid = const Value.absent(),
  }) : key = Value(key),
       value = Value(value);
  static Insertable<AppMetaData> custom({
    Expression<String>? key,
    Expression<String>? value,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (value != null) 'value': value,
      if (rowid != null) 'rowid': rowid,
    });
  }

  AppMetaCompanion copyWith({
    Value<String>? key,
    Value<String>? value,
    Value<int>? rowid,
  }) {
    return AppMetaCompanion(
      key: key ?? this.key,
      value: value ?? this.value,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('AppMetaCompanion(')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LocalRecordsTable extends LocalRecords
    with TableInfo<$LocalRecordsTable, LocalRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _entityMeta = const VerificationMeta('entity');
  @override
  late final GeneratedColumn<String> entity = GeneratedColumn<String>(
    'entity',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<String> updatedAt = GeneratedColumn<String>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dataMeta = const VerificationMeta('data');
  @override
  late final GeneratedColumn<String> data = GeneratedColumn<String>(
    'data',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [entity, id, updatedAt, data];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_records';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocalRecord> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('entity')) {
      context.handle(
        _entityMeta,
        entity.isAcceptableOrUnknown(data['entity']!, _entityMeta),
      );
    } else if (isInserting) {
      context.missing(_entityMeta);
    }
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('data')) {
      context.handle(
        _dataMeta,
        this.data.isAcceptableOrUnknown(data['data']!, _dataMeta),
      );
    } else if (isInserting) {
      context.missing(_dataMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {entity, id};
  @override
  LocalRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalRecord(
      entity: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity'],
      )!,
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}updated_at'],
      )!,
      data: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}data'],
      )!,
    );
  }

  @override
  $LocalRecordsTable createAlias(String alias) {
    return $LocalRecordsTable(attachedDatabase, alias);
  }
}

class LocalRecord extends DataClass implements Insertable<LocalRecord> {
  final String entity;
  final String id;
  final String updatedAt;
  final String data;
  const LocalRecord({
    required this.entity,
    required this.id,
    required this.updatedAt,
    required this.data,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['entity'] = Variable<String>(entity);
    map['id'] = Variable<String>(id);
    map['updated_at'] = Variable<String>(updatedAt);
    map['data'] = Variable<String>(data);
    return map;
  }

  LocalRecordsCompanion toCompanion(bool nullToAbsent) {
    return LocalRecordsCompanion(
      entity: Value(entity),
      id: Value(id),
      updatedAt: Value(updatedAt),
      data: Value(data),
    );
  }

  factory LocalRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalRecord(
      entity: serializer.fromJson<String>(json['entity']),
      id: serializer.fromJson<String>(json['id']),
      updatedAt: serializer.fromJson<String>(json['updatedAt']),
      data: serializer.fromJson<String>(json['data']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'entity': serializer.toJson<String>(entity),
      'id': serializer.toJson<String>(id),
      'updatedAt': serializer.toJson<String>(updatedAt),
      'data': serializer.toJson<String>(data),
    };
  }

  LocalRecord copyWith({
    String? entity,
    String? id,
    String? updatedAt,
    String? data,
  }) => LocalRecord(
    entity: entity ?? this.entity,
    id: id ?? this.id,
    updatedAt: updatedAt ?? this.updatedAt,
    data: data ?? this.data,
  );
  LocalRecord copyWithCompanion(LocalRecordsCompanion data) {
    return LocalRecord(
      entity: data.entity.present ? data.entity.value : this.entity,
      id: data.id.present ? data.id.value : this.id,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      data: data.data.present ? data.data.value : this.data,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalRecord(')
          ..write('entity: $entity, ')
          ..write('id: $id, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('data: $data')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(entity, id, updatedAt, data);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalRecord &&
          other.entity == this.entity &&
          other.id == this.id &&
          other.updatedAt == this.updatedAt &&
          other.data == this.data);
}

class LocalRecordsCompanion extends UpdateCompanion<LocalRecord> {
  final Value<String> entity;
  final Value<String> id;
  final Value<String> updatedAt;
  final Value<String> data;
  final Value<int> rowid;
  const LocalRecordsCompanion({
    this.entity = const Value.absent(),
    this.id = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.data = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalRecordsCompanion.insert({
    required String entity,
    required String id,
    required String updatedAt,
    required String data,
    this.rowid = const Value.absent(),
  }) : entity = Value(entity),
       id = Value(id),
       updatedAt = Value(updatedAt),
       data = Value(data);
  static Insertable<LocalRecord> custom({
    Expression<String>? entity,
    Expression<String>? id,
    Expression<String>? updatedAt,
    Expression<String>? data,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (entity != null) 'entity': entity,
      if (id != null) 'id': id,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (data != null) 'data': data,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalRecordsCompanion copyWith({
    Value<String>? entity,
    Value<String>? id,
    Value<String>? updatedAt,
    Value<String>? data,
    Value<int>? rowid,
  }) {
    return LocalRecordsCompanion(
      entity: entity ?? this.entity,
      id: id ?? this.id,
      updatedAt: updatedAt ?? this.updatedAt,
      data: data ?? this.data,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (entity.present) {
      map['entity'] = Variable<String>(entity.value);
    }
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<String>(updatedAt.value);
    }
    if (data.present) {
      map['data'] = Variable<String>(data.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalRecordsCompanion(')
          ..write('entity: $entity, ')
          ..write('id: $id, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('data: $data, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $OutboxTable extends Outbox with TableInfo<$OutboxTable, OutboxEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OutboxTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _seqMeta = const VerificationMeta('seq');
  @override
  late final GeneratedColumn<int> seq = GeneratedColumn<int>(
    'seq',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _opIdMeta = const VerificationMeta('opId');
  @override
  late final GeneratedColumn<String> opId = GeneratedColumn<String>(
    'op_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _entityMeta = const VerificationMeta('entity');
  @override
  late final GeneratedColumn<String> entity = GeneratedColumn<String>(
    'entity',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _entityIdMeta = const VerificationMeta(
    'entityId',
  );
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
    'entity_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _opMeta = const VerificationMeta('op');
  @override
  late final GeneratedColumn<String> op = GeneratedColumn<String>(
    'op',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<String> updatedAt = GeneratedColumn<String>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _baseUpdatedAtMeta = const VerificationMeta(
    'baseUpdatedAt',
  );
  @override
  late final GeneratedColumn<String> baseUpdatedAt = GeneratedColumn<String>(
    'base_updated_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nextAttemptAtMeta = const VerificationMeta(
    'nextAttemptAt',
  );
  @override
  late final GeneratedColumn<String> nextAttemptAt = GeneratedColumn<String>(
    'next_attempt_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    seq,
    opId,
    entity,
    entityId,
    op,
    payload,
    updatedAt,
    baseUpdatedAt,
    status,
    attempts,
    lastError,
    nextAttemptAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'outbox';
  @override
  VerificationContext validateIntegrity(
    Insertable<OutboxEntry> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('seq')) {
      context.handle(
        _seqMeta,
        seq.isAcceptableOrUnknown(data['seq']!, _seqMeta),
      );
    }
    if (data.containsKey('op_id')) {
      context.handle(
        _opIdMeta,
        opId.isAcceptableOrUnknown(data['op_id']!, _opIdMeta),
      );
    } else if (isInserting) {
      context.missing(_opIdMeta);
    }
    if (data.containsKey('entity')) {
      context.handle(
        _entityMeta,
        entity.isAcceptableOrUnknown(data['entity']!, _entityMeta),
      );
    } else if (isInserting) {
      context.missing(_entityMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(
        _entityIdMeta,
        entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta),
      );
    } else if (isInserting) {
      context.missing(_entityIdMeta);
    }
    if (data.containsKey('op')) {
      context.handle(_opMeta, op.isAcceptableOrUnknown(data['op']!, _opMeta));
    } else if (isInserting) {
      context.missing(_opMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('base_updated_at')) {
      context.handle(
        _baseUpdatedAtMeta,
        baseUpdatedAt.isAcceptableOrUnknown(
          data['base_updated_at']!,
          _baseUpdatedAtMeta,
        ),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    if (data.containsKey('next_attempt_at')) {
      context.handle(
        _nextAttemptAtMeta,
        nextAttemptAt.isAcceptableOrUnknown(
          data['next_attempt_at']!,
          _nextAttemptAtMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {seq};
  @override
  OutboxEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OutboxEntry(
      seq: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}seq'],
      )!,
      opId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}op_id'],
      )!,
      entity: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity'],
      )!,
      entityId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_id'],
      )!,
      op: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}op'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}updated_at'],
      )!,
      baseUpdatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}base_updated_at'],
      ),
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
      nextAttemptAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}next_attempt_at'],
      ),
    );
  }

  @override
  $OutboxTable createAlias(String alias) {
    return $OutboxTable(attachedDatabase, alias);
  }
}

class OutboxEntry extends DataClass implements Insertable<OutboxEntry> {
  final int seq;
  final String opId;
  final String entity;
  final String entityId;
  final String op;
  final String payload;
  final String updatedAt;
  final String? baseUpdatedAt;
  final String status;
  final int attempts;
  final String? lastError;
  final String? nextAttemptAt;
  const OutboxEntry({
    required this.seq,
    required this.opId,
    required this.entity,
    required this.entityId,
    required this.op,
    required this.payload,
    required this.updatedAt,
    this.baseUpdatedAt,
    required this.status,
    required this.attempts,
    this.lastError,
    this.nextAttemptAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['seq'] = Variable<int>(seq);
    map['op_id'] = Variable<String>(opId);
    map['entity'] = Variable<String>(entity);
    map['entity_id'] = Variable<String>(entityId);
    map['op'] = Variable<String>(op);
    map['payload'] = Variable<String>(payload);
    map['updated_at'] = Variable<String>(updatedAt);
    if (!nullToAbsent || baseUpdatedAt != null) {
      map['base_updated_at'] = Variable<String>(baseUpdatedAt);
    }
    map['status'] = Variable<String>(status);
    map['attempts'] = Variable<int>(attempts);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    if (!nullToAbsent || nextAttemptAt != null) {
      map['next_attempt_at'] = Variable<String>(nextAttemptAt);
    }
    return map;
  }

  OutboxCompanion toCompanion(bool nullToAbsent) {
    return OutboxCompanion(
      seq: Value(seq),
      opId: Value(opId),
      entity: Value(entity),
      entityId: Value(entityId),
      op: Value(op),
      payload: Value(payload),
      updatedAt: Value(updatedAt),
      baseUpdatedAt: baseUpdatedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(baseUpdatedAt),
      status: Value(status),
      attempts: Value(attempts),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      nextAttemptAt: nextAttemptAt == null && nullToAbsent
          ? const Value.absent()
          : Value(nextAttemptAt),
    );
  }

  factory OutboxEntry.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OutboxEntry(
      seq: serializer.fromJson<int>(json['seq']),
      opId: serializer.fromJson<String>(json['opId']),
      entity: serializer.fromJson<String>(json['entity']),
      entityId: serializer.fromJson<String>(json['entityId']),
      op: serializer.fromJson<String>(json['op']),
      payload: serializer.fromJson<String>(json['payload']),
      updatedAt: serializer.fromJson<String>(json['updatedAt']),
      baseUpdatedAt: serializer.fromJson<String?>(json['baseUpdatedAt']),
      status: serializer.fromJson<String>(json['status']),
      attempts: serializer.fromJson<int>(json['attempts']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      nextAttemptAt: serializer.fromJson<String?>(json['nextAttemptAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'seq': serializer.toJson<int>(seq),
      'opId': serializer.toJson<String>(opId),
      'entity': serializer.toJson<String>(entity),
      'entityId': serializer.toJson<String>(entityId),
      'op': serializer.toJson<String>(op),
      'payload': serializer.toJson<String>(payload),
      'updatedAt': serializer.toJson<String>(updatedAt),
      'baseUpdatedAt': serializer.toJson<String?>(baseUpdatedAt),
      'status': serializer.toJson<String>(status),
      'attempts': serializer.toJson<int>(attempts),
      'lastError': serializer.toJson<String?>(lastError),
      'nextAttemptAt': serializer.toJson<String?>(nextAttemptAt),
    };
  }

  OutboxEntry copyWith({
    int? seq,
    String? opId,
    String? entity,
    String? entityId,
    String? op,
    String? payload,
    String? updatedAt,
    Value<String?> baseUpdatedAt = const Value.absent(),
    String? status,
    int? attempts,
    Value<String?> lastError = const Value.absent(),
    Value<String?> nextAttemptAt = const Value.absent(),
  }) => OutboxEntry(
    seq: seq ?? this.seq,
    opId: opId ?? this.opId,
    entity: entity ?? this.entity,
    entityId: entityId ?? this.entityId,
    op: op ?? this.op,
    payload: payload ?? this.payload,
    updatedAt: updatedAt ?? this.updatedAt,
    baseUpdatedAt: baseUpdatedAt.present
        ? baseUpdatedAt.value
        : this.baseUpdatedAt,
    status: status ?? this.status,
    attempts: attempts ?? this.attempts,
    lastError: lastError.present ? lastError.value : this.lastError,
    nextAttemptAt: nextAttemptAt.present
        ? nextAttemptAt.value
        : this.nextAttemptAt,
  );
  OutboxEntry copyWithCompanion(OutboxCompanion data) {
    return OutboxEntry(
      seq: data.seq.present ? data.seq.value : this.seq,
      opId: data.opId.present ? data.opId.value : this.opId,
      entity: data.entity.present ? data.entity.value : this.entity,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      op: data.op.present ? data.op.value : this.op,
      payload: data.payload.present ? data.payload.value : this.payload,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      baseUpdatedAt: data.baseUpdatedAt.present
          ? data.baseUpdatedAt.value
          : this.baseUpdatedAt,
      status: data.status.present ? data.status.value : this.status,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      nextAttemptAt: data.nextAttemptAt.present
          ? data.nextAttemptAt.value
          : this.nextAttemptAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OutboxEntry(')
          ..write('seq: $seq, ')
          ..write('opId: $opId, ')
          ..write('entity: $entity, ')
          ..write('entityId: $entityId, ')
          ..write('op: $op, ')
          ..write('payload: $payload, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('baseUpdatedAt: $baseUpdatedAt, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError, ')
          ..write('nextAttemptAt: $nextAttemptAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    seq,
    opId,
    entity,
    entityId,
    op,
    payload,
    updatedAt,
    baseUpdatedAt,
    status,
    attempts,
    lastError,
    nextAttemptAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OutboxEntry &&
          other.seq == this.seq &&
          other.opId == this.opId &&
          other.entity == this.entity &&
          other.entityId == this.entityId &&
          other.op == this.op &&
          other.payload == this.payload &&
          other.updatedAt == this.updatedAt &&
          other.baseUpdatedAt == this.baseUpdatedAt &&
          other.status == this.status &&
          other.attempts == this.attempts &&
          other.lastError == this.lastError &&
          other.nextAttemptAt == this.nextAttemptAt);
}

class OutboxCompanion extends UpdateCompanion<OutboxEntry> {
  final Value<int> seq;
  final Value<String> opId;
  final Value<String> entity;
  final Value<String> entityId;
  final Value<String> op;
  final Value<String> payload;
  final Value<String> updatedAt;
  final Value<String?> baseUpdatedAt;
  final Value<String> status;
  final Value<int> attempts;
  final Value<String?> lastError;
  final Value<String?> nextAttemptAt;
  const OutboxCompanion({
    this.seq = const Value.absent(),
    this.opId = const Value.absent(),
    this.entity = const Value.absent(),
    this.entityId = const Value.absent(),
    this.op = const Value.absent(),
    this.payload = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.baseUpdatedAt = const Value.absent(),
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
  });
  OutboxCompanion.insert({
    this.seq = const Value.absent(),
    required String opId,
    required String entity,
    required String entityId,
    required String op,
    required String payload,
    required String updatedAt,
    this.baseUpdatedAt = const Value.absent(),
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
  }) : opId = Value(opId),
       entity = Value(entity),
       entityId = Value(entityId),
       op = Value(op),
       payload = Value(payload),
       updatedAt = Value(updatedAt);
  static Insertable<OutboxEntry> custom({
    Expression<int>? seq,
    Expression<String>? opId,
    Expression<String>? entity,
    Expression<String>? entityId,
    Expression<String>? op,
    Expression<String>? payload,
    Expression<String>? updatedAt,
    Expression<String>? baseUpdatedAt,
    Expression<String>? status,
    Expression<int>? attempts,
    Expression<String>? lastError,
    Expression<String>? nextAttemptAt,
  }) {
    return RawValuesInsertable({
      if (seq != null) 'seq': seq,
      if (opId != null) 'op_id': opId,
      if (entity != null) 'entity': entity,
      if (entityId != null) 'entity_id': entityId,
      if (op != null) 'op': op,
      if (payload != null) 'payload': payload,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (baseUpdatedAt != null) 'base_updated_at': baseUpdatedAt,
      if (status != null) 'status': status,
      if (attempts != null) 'attempts': attempts,
      if (lastError != null) 'last_error': lastError,
      if (nextAttemptAt != null) 'next_attempt_at': nextAttemptAt,
    });
  }

  OutboxCompanion copyWith({
    Value<int>? seq,
    Value<String>? opId,
    Value<String>? entity,
    Value<String>? entityId,
    Value<String>? op,
    Value<String>? payload,
    Value<String>? updatedAt,
    Value<String?>? baseUpdatedAt,
    Value<String>? status,
    Value<int>? attempts,
    Value<String?>? lastError,
    Value<String?>? nextAttemptAt,
  }) {
    return OutboxCompanion(
      seq: seq ?? this.seq,
      opId: opId ?? this.opId,
      entity: entity ?? this.entity,
      entityId: entityId ?? this.entityId,
      op: op ?? this.op,
      payload: payload ?? this.payload,
      updatedAt: updatedAt ?? this.updatedAt,
      baseUpdatedAt: baseUpdatedAt ?? this.baseUpdatedAt,
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      lastError: lastError ?? this.lastError,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (seq.present) {
      map['seq'] = Variable<int>(seq.value);
    }
    if (opId.present) {
      map['op_id'] = Variable<String>(opId.value);
    }
    if (entity.present) {
      map['entity'] = Variable<String>(entity.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (op.present) {
      map['op'] = Variable<String>(op.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<String>(updatedAt.value);
    }
    if (baseUpdatedAt.present) {
      map['base_updated_at'] = Variable<String>(baseUpdatedAt.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (nextAttemptAt.present) {
      map['next_attempt_at'] = Variable<String>(nextAttemptAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OutboxCompanion(')
          ..write('seq: $seq, ')
          ..write('opId: $opId, ')
          ..write('entity: $entity, ')
          ..write('entityId: $entityId, ')
          ..write('op: $op, ')
          ..write('payload: $payload, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('baseUpdatedAt: $baseUpdatedAt, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError, ')
          ..write('nextAttemptAt: $nextAttemptAt')
          ..write(')'))
        .toString();
  }
}

class $PhotoOutboxTable extends PhotoOutbox
    with TableInfo<$PhotoOutboxTable, PhotoOutboxEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PhotoOutboxTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _seqMeta = const VerificationMeta('seq');
  @override
  late final GeneratedColumn<int> seq = GeneratedColumn<int>(
    'seq',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _photoIdMeta = const VerificationMeta(
    'photoId',
  );
  @override
  late final GeneratedColumn<String> photoId = GeneratedColumn<String>(
    'photo_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _visitIdMeta = const VerificationMeta(
    'visitId',
  );
  @override
  late final GeneratedColumn<String> visitId = GeneratedColumn<String>(
    'visit_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _filePathMeta = const VerificationMeta(
    'filePath',
  );
  @override
  late final GeneratedColumn<String> filePath = GeneratedColumn<String>(
    'file_path',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nextAttemptAtMeta = const VerificationMeta(
    'nextAttemptAt',
  );
  @override
  late final GeneratedColumn<String> nextAttemptAt = GeneratedColumn<String>(
    'next_attempt_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    seq,
    photoId,
    visitId,
    filePath,
    status,
    attempts,
    lastError,
    nextAttemptAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'photo_outbox';
  @override
  VerificationContext validateIntegrity(
    Insertable<PhotoOutboxEntry> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('seq')) {
      context.handle(
        _seqMeta,
        seq.isAcceptableOrUnknown(data['seq']!, _seqMeta),
      );
    }
    if (data.containsKey('photo_id')) {
      context.handle(
        _photoIdMeta,
        photoId.isAcceptableOrUnknown(data['photo_id']!, _photoIdMeta),
      );
    } else if (isInserting) {
      context.missing(_photoIdMeta);
    }
    if (data.containsKey('visit_id')) {
      context.handle(
        _visitIdMeta,
        visitId.isAcceptableOrUnknown(data['visit_id']!, _visitIdMeta),
      );
    } else if (isInserting) {
      context.missing(_visitIdMeta);
    }
    if (data.containsKey('file_path')) {
      context.handle(
        _filePathMeta,
        filePath.isAcceptableOrUnknown(data['file_path']!, _filePathMeta),
      );
    } else if (isInserting) {
      context.missing(_filePathMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    if (data.containsKey('next_attempt_at')) {
      context.handle(
        _nextAttemptAtMeta,
        nextAttemptAt.isAcceptableOrUnknown(
          data['next_attempt_at']!,
          _nextAttemptAtMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {seq};
  @override
  PhotoOutboxEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PhotoOutboxEntry(
      seq: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}seq'],
      )!,
      photoId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}photo_id'],
      )!,
      visitId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}visit_id'],
      )!,
      filePath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}file_path'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
      nextAttemptAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}next_attempt_at'],
      ),
    );
  }

  @override
  $PhotoOutboxTable createAlias(String alias) {
    return $PhotoOutboxTable(attachedDatabase, alias);
  }
}

class PhotoOutboxEntry extends DataClass
    implements Insertable<PhotoOutboxEntry> {
  final int seq;
  final String photoId;
  final String visitId;
  final String filePath;
  final String status;
  final int attempts;
  final String? lastError;
  final String? nextAttemptAt;
  const PhotoOutboxEntry({
    required this.seq,
    required this.photoId,
    required this.visitId,
    required this.filePath,
    required this.status,
    required this.attempts,
    this.lastError,
    this.nextAttemptAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['seq'] = Variable<int>(seq);
    map['photo_id'] = Variable<String>(photoId);
    map['visit_id'] = Variable<String>(visitId);
    map['file_path'] = Variable<String>(filePath);
    map['status'] = Variable<String>(status);
    map['attempts'] = Variable<int>(attempts);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    if (!nullToAbsent || nextAttemptAt != null) {
      map['next_attempt_at'] = Variable<String>(nextAttemptAt);
    }
    return map;
  }

  PhotoOutboxCompanion toCompanion(bool nullToAbsent) {
    return PhotoOutboxCompanion(
      seq: Value(seq),
      photoId: Value(photoId),
      visitId: Value(visitId),
      filePath: Value(filePath),
      status: Value(status),
      attempts: Value(attempts),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      nextAttemptAt: nextAttemptAt == null && nullToAbsent
          ? const Value.absent()
          : Value(nextAttemptAt),
    );
  }

  factory PhotoOutboxEntry.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PhotoOutboxEntry(
      seq: serializer.fromJson<int>(json['seq']),
      photoId: serializer.fromJson<String>(json['photoId']),
      visitId: serializer.fromJson<String>(json['visitId']),
      filePath: serializer.fromJson<String>(json['filePath']),
      status: serializer.fromJson<String>(json['status']),
      attempts: serializer.fromJson<int>(json['attempts']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      nextAttemptAt: serializer.fromJson<String?>(json['nextAttemptAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'seq': serializer.toJson<int>(seq),
      'photoId': serializer.toJson<String>(photoId),
      'visitId': serializer.toJson<String>(visitId),
      'filePath': serializer.toJson<String>(filePath),
      'status': serializer.toJson<String>(status),
      'attempts': serializer.toJson<int>(attempts),
      'lastError': serializer.toJson<String?>(lastError),
      'nextAttemptAt': serializer.toJson<String?>(nextAttemptAt),
    };
  }

  PhotoOutboxEntry copyWith({
    int? seq,
    String? photoId,
    String? visitId,
    String? filePath,
    String? status,
    int? attempts,
    Value<String?> lastError = const Value.absent(),
    Value<String?> nextAttemptAt = const Value.absent(),
  }) => PhotoOutboxEntry(
    seq: seq ?? this.seq,
    photoId: photoId ?? this.photoId,
    visitId: visitId ?? this.visitId,
    filePath: filePath ?? this.filePath,
    status: status ?? this.status,
    attempts: attempts ?? this.attempts,
    lastError: lastError.present ? lastError.value : this.lastError,
    nextAttemptAt: nextAttemptAt.present
        ? nextAttemptAt.value
        : this.nextAttemptAt,
  );
  PhotoOutboxEntry copyWithCompanion(PhotoOutboxCompanion data) {
    return PhotoOutboxEntry(
      seq: data.seq.present ? data.seq.value : this.seq,
      photoId: data.photoId.present ? data.photoId.value : this.photoId,
      visitId: data.visitId.present ? data.visitId.value : this.visitId,
      filePath: data.filePath.present ? data.filePath.value : this.filePath,
      status: data.status.present ? data.status.value : this.status,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      nextAttemptAt: data.nextAttemptAt.present
          ? data.nextAttemptAt.value
          : this.nextAttemptAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PhotoOutboxEntry(')
          ..write('seq: $seq, ')
          ..write('photoId: $photoId, ')
          ..write('visitId: $visitId, ')
          ..write('filePath: $filePath, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError, ')
          ..write('nextAttemptAt: $nextAttemptAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    seq,
    photoId,
    visitId,
    filePath,
    status,
    attempts,
    lastError,
    nextAttemptAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PhotoOutboxEntry &&
          other.seq == this.seq &&
          other.photoId == this.photoId &&
          other.visitId == this.visitId &&
          other.filePath == this.filePath &&
          other.status == this.status &&
          other.attempts == this.attempts &&
          other.lastError == this.lastError &&
          other.nextAttemptAt == this.nextAttemptAt);
}

class PhotoOutboxCompanion extends UpdateCompanion<PhotoOutboxEntry> {
  final Value<int> seq;
  final Value<String> photoId;
  final Value<String> visitId;
  final Value<String> filePath;
  final Value<String> status;
  final Value<int> attempts;
  final Value<String?> lastError;
  final Value<String?> nextAttemptAt;
  const PhotoOutboxCompanion({
    this.seq = const Value.absent(),
    this.photoId = const Value.absent(),
    this.visitId = const Value.absent(),
    this.filePath = const Value.absent(),
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
  });
  PhotoOutboxCompanion.insert({
    this.seq = const Value.absent(),
    required String photoId,
    required String visitId,
    required String filePath,
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
  }) : photoId = Value(photoId),
       visitId = Value(visitId),
       filePath = Value(filePath);
  static Insertable<PhotoOutboxEntry> custom({
    Expression<int>? seq,
    Expression<String>? photoId,
    Expression<String>? visitId,
    Expression<String>? filePath,
    Expression<String>? status,
    Expression<int>? attempts,
    Expression<String>? lastError,
    Expression<String>? nextAttemptAt,
  }) {
    return RawValuesInsertable({
      if (seq != null) 'seq': seq,
      if (photoId != null) 'photo_id': photoId,
      if (visitId != null) 'visit_id': visitId,
      if (filePath != null) 'file_path': filePath,
      if (status != null) 'status': status,
      if (attempts != null) 'attempts': attempts,
      if (lastError != null) 'last_error': lastError,
      if (nextAttemptAt != null) 'next_attempt_at': nextAttemptAt,
    });
  }

  PhotoOutboxCompanion copyWith({
    Value<int>? seq,
    Value<String>? photoId,
    Value<String>? visitId,
    Value<String>? filePath,
    Value<String>? status,
    Value<int>? attempts,
    Value<String?>? lastError,
    Value<String?>? nextAttemptAt,
  }) {
    return PhotoOutboxCompanion(
      seq: seq ?? this.seq,
      photoId: photoId ?? this.photoId,
      visitId: visitId ?? this.visitId,
      filePath: filePath ?? this.filePath,
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      lastError: lastError ?? this.lastError,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (seq.present) {
      map['seq'] = Variable<int>(seq.value);
    }
    if (photoId.present) {
      map['photo_id'] = Variable<String>(photoId.value);
    }
    if (visitId.present) {
      map['visit_id'] = Variable<String>(visitId.value);
    }
    if (filePath.present) {
      map['file_path'] = Variable<String>(filePath.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (nextAttemptAt.present) {
      map['next_attempt_at'] = Variable<String>(nextAttemptAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PhotoOutboxCompanion(')
          ..write('seq: $seq, ')
          ..write('photoId: $photoId, ')
          ..write('visitId: $visitId, ')
          ..write('filePath: $filePath, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError, ')
          ..write('nextAttemptAt: $nextAttemptAt')
          ..write(')'))
        .toString();
  }
}

class $RestQueueTable extends RestQueue
    with TableInfo<$RestQueueTable, RestQueueEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RestQueueTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _seqMeta = const VerificationMeta('seq');
  @override
  late final GeneratedColumn<int> seq = GeneratedColumn<int>(
    'seq',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
    'kind',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _targetIdMeta = const VerificationMeta(
    'targetId',
  );
  @override
  late final GeneratedColumn<String> targetId = GeneratedColumn<String>(
    'target_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nextAttemptAtMeta = const VerificationMeta(
    'nextAttemptAt',
  );
  @override
  late final GeneratedColumn<String> nextAttemptAt = GeneratedColumn<String>(
    'next_attempt_at',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<String> createdAt = GeneratedColumn<String>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    seq,
    kind,
    targetId,
    payload,
    status,
    attempts,
    lastError,
    nextAttemptAt,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'rest_queue';
  @override
  VerificationContext validateIntegrity(
    Insertable<RestQueueEntry> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('seq')) {
      context.handle(
        _seqMeta,
        seq.isAcceptableOrUnknown(data['seq']!, _seqMeta),
      );
    }
    if (data.containsKey('kind')) {
      context.handle(
        _kindMeta,
        kind.isAcceptableOrUnknown(data['kind']!, _kindMeta),
      );
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('target_id')) {
      context.handle(
        _targetIdMeta,
        targetId.isAcceptableOrUnknown(data['target_id']!, _targetIdMeta),
      );
    } else if (isInserting) {
      context.missing(_targetIdMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    if (data.containsKey('next_attempt_at')) {
      context.handle(
        _nextAttemptAtMeta,
        nextAttemptAt.isAcceptableOrUnknown(
          data['next_attempt_at']!,
          _nextAttemptAtMeta,
        ),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {seq};
  @override
  RestQueueEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RestQueueEntry(
      seq: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}seq'],
      )!,
      kind: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}kind'],
      )!,
      targetId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}target_id'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
      nextAttemptAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}next_attempt_at'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $RestQueueTable createAlias(String alias) {
    return $RestQueueTable(attachedDatabase, alias);
  }
}

class RestQueueEntry extends DataClass implements Insertable<RestQueueEntry> {
  final int seq;
  final String kind;
  final String targetId;
  final String payload;
  final String status;
  final int attempts;
  final String? lastError;
  final String? nextAttemptAt;
  final String createdAt;
  const RestQueueEntry({
    required this.seq,
    required this.kind,
    required this.targetId,
    required this.payload,
    required this.status,
    required this.attempts,
    this.lastError,
    this.nextAttemptAt,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['seq'] = Variable<int>(seq);
    map['kind'] = Variable<String>(kind);
    map['target_id'] = Variable<String>(targetId);
    map['payload'] = Variable<String>(payload);
    map['status'] = Variable<String>(status);
    map['attempts'] = Variable<int>(attempts);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    if (!nullToAbsent || nextAttemptAt != null) {
      map['next_attempt_at'] = Variable<String>(nextAttemptAt);
    }
    map['created_at'] = Variable<String>(createdAt);
    return map;
  }

  RestQueueCompanion toCompanion(bool nullToAbsent) {
    return RestQueueCompanion(
      seq: Value(seq),
      kind: Value(kind),
      targetId: Value(targetId),
      payload: Value(payload),
      status: Value(status),
      attempts: Value(attempts),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      nextAttemptAt: nextAttemptAt == null && nullToAbsent
          ? const Value.absent()
          : Value(nextAttemptAt),
      createdAt: Value(createdAt),
    );
  }

  factory RestQueueEntry.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RestQueueEntry(
      seq: serializer.fromJson<int>(json['seq']),
      kind: serializer.fromJson<String>(json['kind']),
      targetId: serializer.fromJson<String>(json['targetId']),
      payload: serializer.fromJson<String>(json['payload']),
      status: serializer.fromJson<String>(json['status']),
      attempts: serializer.fromJson<int>(json['attempts']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      nextAttemptAt: serializer.fromJson<String?>(json['nextAttemptAt']),
      createdAt: serializer.fromJson<String>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'seq': serializer.toJson<int>(seq),
      'kind': serializer.toJson<String>(kind),
      'targetId': serializer.toJson<String>(targetId),
      'payload': serializer.toJson<String>(payload),
      'status': serializer.toJson<String>(status),
      'attempts': serializer.toJson<int>(attempts),
      'lastError': serializer.toJson<String?>(lastError),
      'nextAttemptAt': serializer.toJson<String?>(nextAttemptAt),
      'createdAt': serializer.toJson<String>(createdAt),
    };
  }

  RestQueueEntry copyWith({
    int? seq,
    String? kind,
    String? targetId,
    String? payload,
    String? status,
    int? attempts,
    Value<String?> lastError = const Value.absent(),
    Value<String?> nextAttemptAt = const Value.absent(),
    String? createdAt,
  }) => RestQueueEntry(
    seq: seq ?? this.seq,
    kind: kind ?? this.kind,
    targetId: targetId ?? this.targetId,
    payload: payload ?? this.payload,
    status: status ?? this.status,
    attempts: attempts ?? this.attempts,
    lastError: lastError.present ? lastError.value : this.lastError,
    nextAttemptAt: nextAttemptAt.present
        ? nextAttemptAt.value
        : this.nextAttemptAt,
    createdAt: createdAt ?? this.createdAt,
  );
  RestQueueEntry copyWithCompanion(RestQueueCompanion data) {
    return RestQueueEntry(
      seq: data.seq.present ? data.seq.value : this.seq,
      kind: data.kind.present ? data.kind.value : this.kind,
      targetId: data.targetId.present ? data.targetId.value : this.targetId,
      payload: data.payload.present ? data.payload.value : this.payload,
      status: data.status.present ? data.status.value : this.status,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      nextAttemptAt: data.nextAttemptAt.present
          ? data.nextAttemptAt.value
          : this.nextAttemptAt,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RestQueueEntry(')
          ..write('seq: $seq, ')
          ..write('kind: $kind, ')
          ..write('targetId: $targetId, ')
          ..write('payload: $payload, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    seq,
    kind,
    targetId,
    payload,
    status,
    attempts,
    lastError,
    nextAttemptAt,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RestQueueEntry &&
          other.seq == this.seq &&
          other.kind == this.kind &&
          other.targetId == this.targetId &&
          other.payload == this.payload &&
          other.status == this.status &&
          other.attempts == this.attempts &&
          other.lastError == this.lastError &&
          other.nextAttemptAt == this.nextAttemptAt &&
          other.createdAt == this.createdAt);
}

class RestQueueCompanion extends UpdateCompanion<RestQueueEntry> {
  final Value<int> seq;
  final Value<String> kind;
  final Value<String> targetId;
  final Value<String> payload;
  final Value<String> status;
  final Value<int> attempts;
  final Value<String?> lastError;
  final Value<String?> nextAttemptAt;
  final Value<String> createdAt;
  const RestQueueCompanion({
    this.seq = const Value.absent(),
    this.kind = const Value.absent(),
    this.targetId = const Value.absent(),
    this.payload = const Value.absent(),
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
    this.createdAt = const Value.absent(),
  });
  RestQueueCompanion.insert({
    this.seq = const Value.absent(),
    required String kind,
    required String targetId,
    required String payload,
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
    required String createdAt,
  }) : kind = Value(kind),
       targetId = Value(targetId),
       payload = Value(payload),
       createdAt = Value(createdAt);
  static Insertable<RestQueueEntry> custom({
    Expression<int>? seq,
    Expression<String>? kind,
    Expression<String>? targetId,
    Expression<String>? payload,
    Expression<String>? status,
    Expression<int>? attempts,
    Expression<String>? lastError,
    Expression<String>? nextAttemptAt,
    Expression<String>? createdAt,
  }) {
    return RawValuesInsertable({
      if (seq != null) 'seq': seq,
      if (kind != null) 'kind': kind,
      if (targetId != null) 'target_id': targetId,
      if (payload != null) 'payload': payload,
      if (status != null) 'status': status,
      if (attempts != null) 'attempts': attempts,
      if (lastError != null) 'last_error': lastError,
      if (nextAttemptAt != null) 'next_attempt_at': nextAttemptAt,
      if (createdAt != null) 'created_at': createdAt,
    });
  }

  RestQueueCompanion copyWith({
    Value<int>? seq,
    Value<String>? kind,
    Value<String>? targetId,
    Value<String>? payload,
    Value<String>? status,
    Value<int>? attempts,
    Value<String?>? lastError,
    Value<String?>? nextAttemptAt,
    Value<String>? createdAt,
  }) {
    return RestQueueCompanion(
      seq: seq ?? this.seq,
      kind: kind ?? this.kind,
      targetId: targetId ?? this.targetId,
      payload: payload ?? this.payload,
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      lastError: lastError ?? this.lastError,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (seq.present) {
      map['seq'] = Variable<int>(seq.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (targetId.present) {
      map['target_id'] = Variable<String>(targetId.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (nextAttemptAt.present) {
      map['next_attempt_at'] = Variable<String>(nextAttemptAt.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<String>(createdAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RestQueueCompanion(')
          ..write('seq: $seq, ')
          ..write('kind: $kind, ')
          ..write('targetId: $targetId, ')
          ..write('payload: $payload, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }
}

class $VisitDraftsTable extends VisitDrafts
    with TableInfo<$VisitDraftsTable, VisitDraftEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $VisitDraftsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _draftIdMeta = const VerificationMeta(
    'draftId',
  );
  @override
  late final GeneratedColumn<String> draftId = GeneratedColumn<String>(
    'draft_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dataMeta = const VerificationMeta('data');
  @override
  late final GeneratedColumn<String> data = GeneratedColumn<String>(
    'data',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<String> updatedAt = GeneratedColumn<String>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [draftId, data, updatedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'visit_drafts';
  @override
  VerificationContext validateIntegrity(
    Insertable<VisitDraftEntry> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('draft_id')) {
      context.handle(
        _draftIdMeta,
        draftId.isAcceptableOrUnknown(data['draft_id']!, _draftIdMeta),
      );
    } else if (isInserting) {
      context.missing(_draftIdMeta);
    }
    if (data.containsKey('data')) {
      context.handle(
        _dataMeta,
        this.data.isAcceptableOrUnknown(data['data']!, _dataMeta),
      );
    } else if (isInserting) {
      context.missing(_dataMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {draftId};
  @override
  VisitDraftEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return VisitDraftEntry(
      draftId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}draft_id'],
      )!,
      data: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}data'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $VisitDraftsTable createAlias(String alias) {
    return $VisitDraftsTable(attachedDatabase, alias);
  }
}

class VisitDraftEntry extends DataClass implements Insertable<VisitDraftEntry> {
  final String draftId;
  final String data;
  final String updatedAt;
  const VisitDraftEntry({
    required this.draftId,
    required this.data,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['draft_id'] = Variable<String>(draftId);
    map['data'] = Variable<String>(data);
    map['updated_at'] = Variable<String>(updatedAt);
    return map;
  }

  VisitDraftsCompanion toCompanion(bool nullToAbsent) {
    return VisitDraftsCompanion(
      draftId: Value(draftId),
      data: Value(data),
      updatedAt: Value(updatedAt),
    );
  }

  factory VisitDraftEntry.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return VisitDraftEntry(
      draftId: serializer.fromJson<String>(json['draftId']),
      data: serializer.fromJson<String>(json['data']),
      updatedAt: serializer.fromJson<String>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'draftId': serializer.toJson<String>(draftId),
      'data': serializer.toJson<String>(data),
      'updatedAt': serializer.toJson<String>(updatedAt),
    };
  }

  VisitDraftEntry copyWith({
    String? draftId,
    String? data,
    String? updatedAt,
  }) => VisitDraftEntry(
    draftId: draftId ?? this.draftId,
    data: data ?? this.data,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  VisitDraftEntry copyWithCompanion(VisitDraftsCompanion data) {
    return VisitDraftEntry(
      draftId: data.draftId.present ? data.draftId.value : this.draftId,
      data: data.data.present ? data.data.value : this.data,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('VisitDraftEntry(')
          ..write('draftId: $draftId, ')
          ..write('data: $data, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(draftId, data, updatedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is VisitDraftEntry &&
          other.draftId == this.draftId &&
          other.data == this.data &&
          other.updatedAt == this.updatedAt);
}

class VisitDraftsCompanion extends UpdateCompanion<VisitDraftEntry> {
  final Value<String> draftId;
  final Value<String> data;
  final Value<String> updatedAt;
  final Value<int> rowid;
  const VisitDraftsCompanion({
    this.draftId = const Value.absent(),
    this.data = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  VisitDraftsCompanion.insert({
    required String draftId,
    required String data,
    required String updatedAt,
    this.rowid = const Value.absent(),
  }) : draftId = Value(draftId),
       data = Value(data),
       updatedAt = Value(updatedAt);
  static Insertable<VisitDraftEntry> custom({
    Expression<String>? draftId,
    Expression<String>? data,
    Expression<String>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (draftId != null) 'draft_id': draftId,
      if (data != null) 'data': data,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  VisitDraftsCompanion copyWith({
    Value<String>? draftId,
    Value<String>? data,
    Value<String>? updatedAt,
    Value<int>? rowid,
  }) {
    return VisitDraftsCompanion(
      draftId: draftId ?? this.draftId,
      data: data ?? this.data,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (draftId.present) {
      map['draft_id'] = Variable<String>(draftId.value);
    }
    if (data.present) {
      map['data'] = Variable<String>(data.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<String>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('VisitDraftsCompanion(')
          ..write('draftId: $draftId, ')
          ..write('data: $data, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $AppMetaTable appMeta = $AppMetaTable(this);
  late final $LocalRecordsTable localRecords = $LocalRecordsTable(this);
  late final $OutboxTable outbox = $OutboxTable(this);
  late final $PhotoOutboxTable photoOutbox = $PhotoOutboxTable(this);
  late final $RestQueueTable restQueue = $RestQueueTable(this);
  late final $VisitDraftsTable visitDrafts = $VisitDraftsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    appMeta,
    localRecords,
    outbox,
    photoOutbox,
    restQueue,
    visitDrafts,
  ];
}

typedef $$AppMetaTableCreateCompanionBuilder = AppMetaCompanion Function({
  required String key,
  required String value,
  Value<int> rowid,
});
typedef $$AppMetaTableUpdateCompanionBuilder = AppMetaCompanion Function({
  Value<String> key,
  Value<String> value,
  Value<int> rowid,
});

class $$AppMetaTableFilterComposer
    extends Composer<_$AppDatabase, $AppMetaTable> {
  $$AppMetaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnFilters(column),
  );
}

class $$AppMetaTableOrderingComposer
    extends Composer<_$AppDatabase, $AppMetaTable> {
  $$AppMetaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$AppMetaTableAnnotationComposer
    extends Composer<_$AppDatabase, $AppMetaTable> {
  $$AppMetaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);
}

class $$AppMetaTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $AppMetaTable,
          AppMetaData,
          $$AppMetaTableFilterComposer,
          $$AppMetaTableOrderingComposer,
          $$AppMetaTableAnnotationComposer,
          $$AppMetaTableCreateCompanionBuilder,
          $$AppMetaTableUpdateCompanionBuilder,
          (
            AppMetaData,
            BaseReferences<_$AppDatabase, $AppMetaTable, AppMetaData>,
          ),
          AppMetaData,
          PrefetchHooks Function()
        > {
  $$AppMetaTableTableManager(_$AppDatabase db, $AppMetaTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$AppMetaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$AppMetaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$AppMetaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> key = const Value.absent(),
            Value<String> value = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) => AppMetaCompanion(key: key, value: value, rowid: rowid),
          createCompanionCallback: ({
            required String key,
            required String value,
            Value<int> rowid = const Value.absent(),
          }) => AppMetaCompanion.insert(key: key, value: value, rowid: rowid),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$AppMetaTable, AppMetaData>(table),
                  BaseReferences<_$AppDatabase, $AppMetaTable, AppMetaData>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$AppMetaTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $AppMetaTable,
      AppMetaData,
      $$AppMetaTableFilterComposer,
      $$AppMetaTableOrderingComposer,
      $$AppMetaTableAnnotationComposer,
      $$AppMetaTableCreateCompanionBuilder,
      $$AppMetaTableUpdateCompanionBuilder,
      (AppMetaData, BaseReferences<_$AppDatabase, $AppMetaTable, AppMetaData>),
      AppMetaData,
      PrefetchHooks Function()
    >;
typedef $$LocalRecordsTableCreateCompanionBuilder =
    LocalRecordsCompanion Function({
      required String entity,
      required String id,
      required String updatedAt,
      required String data,
      Value<int> rowid,
    });
typedef $$LocalRecordsTableUpdateCompanionBuilder =
    LocalRecordsCompanion Function({
      Value<String> entity,
      Value<String> id,
      Value<String> updatedAt,
      Value<String> data,
      Value<int> rowid,
    });

class $$LocalRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $LocalRecordsTable> {
  $$LocalRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get entity => $composableBuilder(
    column: $table.entity,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get data => $composableBuilder(
    column: $table.data,
    builder: (column) => ColumnFilters(column),
  );
}

class $$LocalRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $LocalRecordsTable> {
  $$LocalRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get entity => $composableBuilder(
    column: $table.entity,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get data => $composableBuilder(
    column: $table.data,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LocalRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $LocalRecordsTable> {
  $$LocalRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get entity =>
      $composableBuilder(column: $table.entity, builder: (column) => column);

  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get data =>
      $composableBuilder(column: $table.data, builder: (column) => column);
}

class $$LocalRecordsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LocalRecordsTable,
          LocalRecord,
          $$LocalRecordsTableFilterComposer,
          $$LocalRecordsTableOrderingComposer,
          $$LocalRecordsTableAnnotationComposer,
          $$LocalRecordsTableCreateCompanionBuilder,
          $$LocalRecordsTableUpdateCompanionBuilder,
          (
            LocalRecord,
            BaseReferences<_$AppDatabase, $LocalRecordsTable, LocalRecord>,
          ),
          LocalRecord,
          PrefetchHooks Function()
        > {
  $$LocalRecordsTableTableManager(_$AppDatabase db, $LocalRecordsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalRecordsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocalRecordsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> entity = const Value.absent(),
                Value<String> id = const Value.absent(),
                Value<String> updatedAt = const Value.absent(),
                Value<String> data = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalRecordsCompanion(
                entity: entity,
                id: id,
                updatedAt: updatedAt,
                data: data,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String entity,
                required String id,
                required String updatedAt,
                required String data,
                Value<int> rowid = const Value.absent(),
              }) => LocalRecordsCompanion.insert(
                entity: entity,
                id: id,
                updatedAt: updatedAt,
                data: data,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$LocalRecordsTable, LocalRecord>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $LocalRecordsTable,
                    LocalRecord
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LocalRecordsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LocalRecordsTable,
      LocalRecord,
      $$LocalRecordsTableFilterComposer,
      $$LocalRecordsTableOrderingComposer,
      $$LocalRecordsTableAnnotationComposer,
      $$LocalRecordsTableCreateCompanionBuilder,
      $$LocalRecordsTableUpdateCompanionBuilder,
      (
        LocalRecord,
        BaseReferences<_$AppDatabase, $LocalRecordsTable, LocalRecord>,
      ),
      LocalRecord,
      PrefetchHooks Function()
    >;
typedef $$OutboxTableCreateCompanionBuilder = OutboxCompanion Function({
  Value<int> seq,
  required String opId,
  required String entity,
  required String entityId,
  required String op,
  required String payload,
  required String updatedAt,
  Value<String?> baseUpdatedAt,
  Value<String> status,
  Value<int> attempts,
  Value<String?> lastError,
  Value<String?> nextAttemptAt,
});
typedef $$OutboxTableUpdateCompanionBuilder = OutboxCompanion Function({
  Value<int> seq,
  Value<String> opId,
  Value<String> entity,
  Value<String> entityId,
  Value<String> op,
  Value<String> payload,
  Value<String> updatedAt,
  Value<String?> baseUpdatedAt,
  Value<String> status,
  Value<int> attempts,
  Value<String?> lastError,
  Value<String?> nextAttemptAt,
});

class $$OutboxTableFilterComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get seq => $composableBuilder(
    column: $table.seq,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get opId => $composableBuilder(
    column: $table.opId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entity => $composableBuilder(
    column: $table.entity,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entityId => $composableBuilder(
    column: $table.entityId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get op => $composableBuilder(
    column: $table.op,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get baseUpdatedAt => $composableBuilder(
    column: $table.baseUpdatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OutboxTableOrderingComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get seq => $composableBuilder(
    column: $table.seq,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get opId => $composableBuilder(
    column: $table.opId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entity => $composableBuilder(
    column: $table.entity,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entityId => $composableBuilder(
    column: $table.entityId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get op => $composableBuilder(
    column: $table.op,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get baseUpdatedAt => $composableBuilder(
    column: $table.baseUpdatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OutboxTableAnnotationComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get seq =>
      $composableBuilder(column: $table.seq, builder: (column) => column);

  GeneratedColumn<String> get opId =>
      $composableBuilder(column: $table.opId, builder: (column) => column);

  GeneratedColumn<String> get entity =>
      $composableBuilder(column: $table.entity, builder: (column) => column);

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<String> get op =>
      $composableBuilder(column: $table.op, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<String> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get baseUpdatedAt => $composableBuilder(
    column: $table.baseUpdatedAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<String> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => column,
  );
}

class $$OutboxTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $OutboxTable,
          OutboxEntry,
          $$OutboxTableFilterComposer,
          $$OutboxTableOrderingComposer,
          $$OutboxTableAnnotationComposer,
          $$OutboxTableCreateCompanionBuilder,
          $$OutboxTableUpdateCompanionBuilder,
          (
            OutboxEntry,
            BaseReferences<_$AppDatabase, $OutboxTable, OutboxEntry>,
          ),
          OutboxEntry,
          PrefetchHooks Function()
        > {
  $$OutboxTableTableManager(_$AppDatabase db, $OutboxTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OutboxTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OutboxTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OutboxTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> seq = const Value.absent(),
                Value<String> opId = const Value.absent(),
                Value<String> entity = const Value.absent(),
                Value<String> entityId = const Value.absent(),
                Value<String> op = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<String> updatedAt = const Value.absent(),
                Value<String?> baseUpdatedAt = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<String?> nextAttemptAt = const Value.absent(),
              }) => OutboxCompanion(
                seq: seq,
                opId: opId,
                entity: entity,
                entityId: entityId,
                op: op,
                payload: payload,
                updatedAt: updatedAt,
                baseUpdatedAt: baseUpdatedAt,
                status: status,
                attempts: attempts,
                lastError: lastError,
                nextAttemptAt: nextAttemptAt,
              ),
          createCompanionCallback:
              ({
                Value<int> seq = const Value.absent(),
                required String opId,
                required String entity,
                required String entityId,
                required String op,
                required String payload,
                required String updatedAt,
                Value<String?> baseUpdatedAt = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<String?> nextAttemptAt = const Value.absent(),
              }) => OutboxCompanion.insert(
                seq: seq,
                opId: opId,
                entity: entity,
                entityId: entityId,
                op: op,
                payload: payload,
                updatedAt: updatedAt,
                baseUpdatedAt: baseUpdatedAt,
                status: status,
                attempts: attempts,
                lastError: lastError,
                nextAttemptAt: nextAttemptAt,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$OutboxTable, OutboxEntry>(table),
                  BaseReferences<_$AppDatabase, $OutboxTable, OutboxEntry>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OutboxTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $OutboxTable,
      OutboxEntry,
      $$OutboxTableFilterComposer,
      $$OutboxTableOrderingComposer,
      $$OutboxTableAnnotationComposer,
      $$OutboxTableCreateCompanionBuilder,
      $$OutboxTableUpdateCompanionBuilder,
      (OutboxEntry, BaseReferences<_$AppDatabase, $OutboxTable, OutboxEntry>),
      OutboxEntry,
      PrefetchHooks Function()
    >;
typedef $$PhotoOutboxTableCreateCompanionBuilder =
    PhotoOutboxCompanion Function({
      Value<int> seq,
      required String photoId,
      required String visitId,
      required String filePath,
      Value<String> status,
      Value<int> attempts,
      Value<String?> lastError,
      Value<String?> nextAttemptAt,
    });
typedef $$PhotoOutboxTableUpdateCompanionBuilder =
    PhotoOutboxCompanion Function({
      Value<int> seq,
      Value<String> photoId,
      Value<String> visitId,
      Value<String> filePath,
      Value<String> status,
      Value<int> attempts,
      Value<String?> lastError,
      Value<String?> nextAttemptAt,
    });

class $$PhotoOutboxTableFilterComposer
    extends Composer<_$AppDatabase, $PhotoOutboxTable> {
  $$PhotoOutboxTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get seq => $composableBuilder(
    column: $table.seq,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get photoId => $composableBuilder(
    column: $table.photoId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get visitId => $composableBuilder(
    column: $table.visitId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get filePath => $composableBuilder(
    column: $table.filePath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PhotoOutboxTableOrderingComposer
    extends Composer<_$AppDatabase, $PhotoOutboxTable> {
  $$PhotoOutboxTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get seq => $composableBuilder(
    column: $table.seq,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get photoId => $composableBuilder(
    column: $table.photoId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get visitId => $composableBuilder(
    column: $table.visitId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get filePath => $composableBuilder(
    column: $table.filePath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PhotoOutboxTableAnnotationComposer
    extends Composer<_$AppDatabase, $PhotoOutboxTable> {
  $$PhotoOutboxTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get seq =>
      $composableBuilder(column: $table.seq, builder: (column) => column);

  GeneratedColumn<String> get photoId =>
      $composableBuilder(column: $table.photoId, builder: (column) => column);

  GeneratedColumn<String> get visitId =>
      $composableBuilder(column: $table.visitId, builder: (column) => column);

  GeneratedColumn<String> get filePath =>
      $composableBuilder(column: $table.filePath, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<String> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => column,
  );
}

class $$PhotoOutboxTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PhotoOutboxTable,
          PhotoOutboxEntry,
          $$PhotoOutboxTableFilterComposer,
          $$PhotoOutboxTableOrderingComposer,
          $$PhotoOutboxTableAnnotationComposer,
          $$PhotoOutboxTableCreateCompanionBuilder,
          $$PhotoOutboxTableUpdateCompanionBuilder,
          (
            PhotoOutboxEntry,
            BaseReferences<_$AppDatabase, $PhotoOutboxTable, PhotoOutboxEntry>,
          ),
          PhotoOutboxEntry,
          PrefetchHooks Function()
        > {
  $$PhotoOutboxTableTableManager(_$AppDatabase db, $PhotoOutboxTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PhotoOutboxTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PhotoOutboxTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PhotoOutboxTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> seq = const Value.absent(),
                Value<String> photoId = const Value.absent(),
                Value<String> visitId = const Value.absent(),
                Value<String> filePath = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<String?> nextAttemptAt = const Value.absent(),
              }) => PhotoOutboxCompanion(
                seq: seq,
                photoId: photoId,
                visitId: visitId,
                filePath: filePath,
                status: status,
                attempts: attempts,
                lastError: lastError,
                nextAttemptAt: nextAttemptAt,
              ),
          createCompanionCallback:
              ({
                Value<int> seq = const Value.absent(),
                required String photoId,
                required String visitId,
                required String filePath,
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<String?> nextAttemptAt = const Value.absent(),
              }) => PhotoOutboxCompanion.insert(
                seq: seq,
                photoId: photoId,
                visitId: visitId,
                filePath: filePath,
                status: status,
                attempts: attempts,
                lastError: lastError,
                nextAttemptAt: nextAttemptAt,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$PhotoOutboxTable, PhotoOutboxEntry>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $PhotoOutboxTable,
                    PhotoOutboxEntry
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PhotoOutboxTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PhotoOutboxTable,
      PhotoOutboxEntry,
      $$PhotoOutboxTableFilterComposer,
      $$PhotoOutboxTableOrderingComposer,
      $$PhotoOutboxTableAnnotationComposer,
      $$PhotoOutboxTableCreateCompanionBuilder,
      $$PhotoOutboxTableUpdateCompanionBuilder,
      (
        PhotoOutboxEntry,
        BaseReferences<_$AppDatabase, $PhotoOutboxTable, PhotoOutboxEntry>,
      ),
      PhotoOutboxEntry,
      PrefetchHooks Function()
    >;
typedef $$RestQueueTableCreateCompanionBuilder = RestQueueCompanion Function({
  Value<int> seq,
  required String kind,
  required String targetId,
  required String payload,
  Value<String> status,
  Value<int> attempts,
  Value<String?> lastError,
  Value<String?> nextAttemptAt,
  required String createdAt,
});
typedef $$RestQueueTableUpdateCompanionBuilder = RestQueueCompanion Function({
  Value<int> seq,
  Value<String> kind,
  Value<String> targetId,
  Value<String> payload,
  Value<String> status,
  Value<int> attempts,
  Value<String?> lastError,
  Value<String?> nextAttemptAt,
  Value<String> createdAt,
});

class $$RestQueueTableFilterComposer
    extends Composer<_$AppDatabase, $RestQueueTable> {
  $$RestQueueTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get seq => $composableBuilder(
    column: $table.seq,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get targetId => $composableBuilder(
    column: $table.targetId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$RestQueueTableOrderingComposer
    extends Composer<_$AppDatabase, $RestQueueTable> {
  $$RestQueueTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get seq => $composableBuilder(
    column: $table.seq,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get targetId => $composableBuilder(
    column: $table.targetId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$RestQueueTableAnnotationComposer
    extends Composer<_$AppDatabase, $RestQueueTable> {
  $$RestQueueTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get seq =>
      $composableBuilder(column: $table.seq, builder: (column) => column);

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<String> get targetId =>
      $composableBuilder(column: $table.targetId, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<String> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$RestQueueTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $RestQueueTable,
          RestQueueEntry,
          $$RestQueueTableFilterComposer,
          $$RestQueueTableOrderingComposer,
          $$RestQueueTableAnnotationComposer,
          $$RestQueueTableCreateCompanionBuilder,
          $$RestQueueTableUpdateCompanionBuilder,
          (
            RestQueueEntry,
            BaseReferences<_$AppDatabase, $RestQueueTable, RestQueueEntry>,
          ),
          RestQueueEntry,
          PrefetchHooks Function()
        > {
  $$RestQueueTableTableManager(_$AppDatabase db, $RestQueueTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RestQueueTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RestQueueTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RestQueueTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> seq = const Value.absent(),
                Value<String> kind = const Value.absent(),
                Value<String> targetId = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<String?> nextAttemptAt = const Value.absent(),
                Value<String> createdAt = const Value.absent(),
              }) => RestQueueCompanion(
                seq: seq,
                kind: kind,
                targetId: targetId,
                payload: payload,
                status: status,
                attempts: attempts,
                lastError: lastError,
                nextAttemptAt: nextAttemptAt,
                createdAt: createdAt,
              ),
          createCompanionCallback:
              ({
                Value<int> seq = const Value.absent(),
                required String kind,
                required String targetId,
                required String payload,
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<String?> nextAttemptAt = const Value.absent(),
                required String createdAt,
              }) => RestQueueCompanion.insert(
                seq: seq,
                kind: kind,
                targetId: targetId,
                payload: payload,
                status: status,
                attempts: attempts,
                lastError: lastError,
                nextAttemptAt: nextAttemptAt,
                createdAt: createdAt,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$RestQueueTable, RestQueueEntry>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $RestQueueTable,
                    RestQueueEntry
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$RestQueueTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $RestQueueTable,
      RestQueueEntry,
      $$RestQueueTableFilterComposer,
      $$RestQueueTableOrderingComposer,
      $$RestQueueTableAnnotationComposer,
      $$RestQueueTableCreateCompanionBuilder,
      $$RestQueueTableUpdateCompanionBuilder,
      (
        RestQueueEntry,
        BaseReferences<_$AppDatabase, $RestQueueTable, RestQueueEntry>,
      ),
      RestQueueEntry,
      PrefetchHooks Function()
    >;
typedef $$VisitDraftsTableCreateCompanionBuilder =
    VisitDraftsCompanion Function({
      required String draftId,
      required String data,
      required String updatedAt,
      Value<int> rowid,
    });
typedef $$VisitDraftsTableUpdateCompanionBuilder =
    VisitDraftsCompanion Function({
      Value<String> draftId,
      Value<String> data,
      Value<String> updatedAt,
      Value<int> rowid,
    });

class $$VisitDraftsTableFilterComposer
    extends Composer<_$AppDatabase, $VisitDraftsTable> {
  $$VisitDraftsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get draftId => $composableBuilder(
    column: $table.draftId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get data => $composableBuilder(
    column: $table.data,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$VisitDraftsTableOrderingComposer
    extends Composer<_$AppDatabase, $VisitDraftsTable> {
  $$VisitDraftsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get draftId => $composableBuilder(
    column: $table.draftId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get data => $composableBuilder(
    column: $table.data,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$VisitDraftsTableAnnotationComposer
    extends Composer<_$AppDatabase, $VisitDraftsTable> {
  $$VisitDraftsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get draftId =>
      $composableBuilder(column: $table.draftId, builder: (column) => column);

  GeneratedColumn<String> get data =>
      $composableBuilder(column: $table.data, builder: (column) => column);

  GeneratedColumn<String> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$VisitDraftsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $VisitDraftsTable,
          VisitDraftEntry,
          $$VisitDraftsTableFilterComposer,
          $$VisitDraftsTableOrderingComposer,
          $$VisitDraftsTableAnnotationComposer,
          $$VisitDraftsTableCreateCompanionBuilder,
          $$VisitDraftsTableUpdateCompanionBuilder,
          (
            VisitDraftEntry,
            BaseReferences<_$AppDatabase, $VisitDraftsTable, VisitDraftEntry>,
          ),
          VisitDraftEntry,
          PrefetchHooks Function()
        > {
  $$VisitDraftsTableTableManager(_$AppDatabase db, $VisitDraftsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$VisitDraftsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$VisitDraftsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$VisitDraftsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> draftId = const Value.absent(),
                Value<String> data = const Value.absent(),
                Value<String> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => VisitDraftsCompanion(
                draftId: draftId,
                data: data,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String draftId,
                required String data,
                required String updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => VisitDraftsCompanion.insert(
                draftId: draftId,
                data: data,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$VisitDraftsTable, VisitDraftEntry>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $VisitDraftsTable,
                    VisitDraftEntry
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$VisitDraftsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $VisitDraftsTable,
      VisitDraftEntry,
      $$VisitDraftsTableFilterComposer,
      $$VisitDraftsTableOrderingComposer,
      $$VisitDraftsTableAnnotationComposer,
      $$VisitDraftsTableCreateCompanionBuilder,
      $$VisitDraftsTableUpdateCompanionBuilder,
      (
        VisitDraftEntry,
        BaseReferences<_$AppDatabase, $VisitDraftsTable, VisitDraftEntry>,
      ),
      VisitDraftEntry,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$AppMetaTableTableManager get appMeta =>
      $$AppMetaTableTableManager(_db, _db.appMeta);
  $$LocalRecordsTableTableManager get localRecords =>
      $$LocalRecordsTableTableManager(_db, _db.localRecords);
  $$OutboxTableTableManager get outbox =>
      $$OutboxTableTableManager(_db, _db.outbox);
  $$PhotoOutboxTableTableManager get photoOutbox =>
      $$PhotoOutboxTableTableManager(_db, _db.photoOutbox);
  $$RestQueueTableTableManager get restQueue =>
      $$RestQueueTableTableManager(_db, _db.restQueue);
  $$VisitDraftsTableTableManager get visitDrafts =>
      $$VisitDraftsTableTableManager(_db, _db.visitDrafts);
}

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Banco criptografado (SQLCipher). A chave é aplicada logo ao abrir.

@ProviderFor(appDatabase)
final appDatabaseProvider = AppDatabaseProvider._();

/// Banco criptografado (SQLCipher). A chave é aplicada logo ao abrir.

final class AppDatabaseProvider
    extends
        $FunctionalProvider<
          AsyncValue<AppDatabase>,
          AppDatabase,
          FutureOr<AppDatabase>
        >
    with $FutureModifier<AppDatabase>, $FutureProvider<AppDatabase> {
  /// Banco criptografado (SQLCipher). A chave é aplicada logo ao abrir.
  AppDatabaseProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'appDatabaseProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$appDatabaseHash();

  @$internal
  @override
  $FutureProviderElement<AppDatabase> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<AppDatabase> create(Ref ref) {
    return appDatabase(ref);
  }
}

String _$appDatabaseHash() => r'03338c3be355419881ae61f5b141424feea949b2';
