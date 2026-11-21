import 'package:flutter/services.dart';

import 'package:material_ui/material_ui.dart';

import '../../core/theme/app_theme.dart';

/// Cartão branco com borda fina e cantos de 4 px (design system).
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final Widget body = Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.line),
        borderRadius: AppTheme.radius,
      ),
      child: child,
    );
    if (onTap == null) return body;
    return InkWell(borderRadius: AppTheme.radius, onTap: onTap, child: body);
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: AppColors.brand,
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(
        text,
        style: const TextStyle(color: AppColors.muted, fontSize: 16),
      ),
    );
  }
}

class InfoLine extends StatelessWidget {
  const InfoLine(this.label, this.value, {super.key});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(color: AppColors.muted, fontSize: 15),
            ),
            TextSpan(
              text: value,
              style: const TextStyle(color: AppColors.ink, fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pílula de status (cor vem do significado: pendente, atenção, ok).
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.color = AppColors.muted});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color),
        borderRadius: AppTheme.radius,
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Botão principal de largura total, ação do rodapé.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(onPressed: onPressed, child: Text(label));
  }
}

/// Campo de texto padrão dos formulários.
class AppField extends StatelessWidget {
  const AppField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.keyboardType,
    this.maxLength,
    this.maxLines = 1,
    this.validator,
    this.enabled = true,
    this.inputFormatters,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final TextInputType? keyboardType;
  final int? maxLength;
  final int maxLines;
  final String? Function(String?)? validator;
  final bool enabled;
  final List<TextInputFormatter>? inputFormatters;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      enabled: enabled,
      keyboardType: keyboardType,
      maxLength: maxLength,
      maxLines: maxLines,
      validator: validator,
      inputFormatters: inputFormatters,
      decoration: InputDecoration(labelText: label, hintText: hint),
    );
  }
}
