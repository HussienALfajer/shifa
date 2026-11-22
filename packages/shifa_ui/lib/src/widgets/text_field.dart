import 'dart:ui' show SemanticsValidationResult;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/metrics.dart';
import 'package:shifa_ui/src/theme/theme.dart';
import 'package:shifa_ui/src/widgets/glyph.dart';

/// Turns Arabic-Indic (٠–٩) and Persian (۰–۹) digits into Western ones as
/// they are typed (OD-20: Western digits are shown and stored everywhere).
/// One character for one, so the caret stays where it was.
class ShifaWesternDigitsFormatter extends TextInputFormatter {
  /// The formatter every [ShifaTextField] uses.
  const new();

  static int _western(int unit) {
    if (unit >= 0x0660 && unit <= 0x0669) return unit - 0x0660 + 0x30;
    if (unit >= 0x06F0 && unit <= 0x06F9) return unit - 0x06F0 + 0x30;
    return unit;
  }

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final units = newValue.text.codeUnits;
    final western = units.map(_western).toList();
    if (_same(units, western)) return newValue;
    return newValue.copyWith(text: String.fromCharCodes(western));
  }

  static bool _same(List<int> a, List<int> b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}

/// A labelled text field of the approved sheet (0.4-08): the label above,
/// a 48 dp box, a helper or an error below. An error is a 2 px brick outline
/// with an icon and words. Built on [EditableText] (no Material).
class ShifaTextField extends StatefulWidget {
  /// A field named [label].
  const new({
    required this.label,
    this.controller,
    this.placeholder,
    this.helper,
    this.error,
    this.enabled = true,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
    this.autofocus = false,
    this.focusNode,
    this.maxLines = 1,
    super.key,
  });

  /// Lines the box shows before it scrolls; 1 makes the keyboard's action
  /// submit, null lets a note grow and the return key break lines.
  final int? maxLines;

  /// The key of the box (tests measure it).
  static const Key boxKey = ValueKey('ShifaTextField.box');

  /// What the field is: «رقم الهاتف».
  final String label;

  /// The text; the field makes its own when null.
  final TextEditingController? controller;

  /// A hint inside the empty box: «كما في الهوية».
  final String? placeholder;

  /// A line of help under the box.
  final String? helper;

  /// What is wrong; replaces [helper] and outlines the box in brick.
  final String? error;

  /// False: no focus and no typing.
  final bool enabled;

  /// The keyboard to show.
  final TextInputType? keyboardType;

  /// The keyboard's action button.
  final TextInputAction? textInputAction;

  /// The text after each change (digits already Western).
  final ValueChanged<String>? onChanged;

  /// The text when the keyboard's action is pressed.
  final ValueChanged<String>? onSubmitted;

  /// Take focus when first shown.
  final bool autofocus;

  /// Focus, for callers that move it.
  final FocusNode? focusNode;

  @override
  State<ShifaTextField> createState() => _ShifaTextFieldState();
}

class _ShifaTextFieldState extends State<ShifaTextField>
    implements TextSelectionGestureDetectorBuilderDelegate {
  TextEditingController? _ownController;
  FocusNode? _ownFocus;
  final FocusNode _disabledFocus = FocusNode(
    debugLabel: 'ShifaTextField (disabled)',
    canRequestFocus: false,
    skipTraversal: true,
  );
  late final _gestures = TextSelectionGestureDetectorBuilder(delegate: this);

  @override
  final GlobalKey<EditableTextState> editableTextKey = GlobalKey();

  @override
  bool get forcePressEnabled => false;

  @override
  bool get selectionEnabled => widget.enabled;

  TextEditingController get _controller =>
      widget.controller ?? (_ownController ??= TextEditingController());

  FocusNode get _focus => widget.focusNode ?? (_ownFocus ??= FocusNode());

  @override
  void initState() {
    super.initState();
    _focus.addListener(_refresh);
  }

  @override
  void didUpdateWidget(ShifaTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.focusNode != widget.focusNode) {
      (oldWidget.focusNode ?? _ownFocus)?.removeListener(_refresh);
      _focus.addListener(_refresh);
    }
    final oldController = oldWidget.controller;
    if (oldController != null && widget.controller == null) {
      // The caller let go of its controller: keep what was typed.
      _ownController = TextEditingController.fromValue(oldController.value);
    } else if (oldController == null && widget.controller != null) {
      _ownController?.dispose();
      _ownController = null;
    }
    if (!widget.enabled && _focus.hasFocus) _focus.unfocus();
  }

  /// A screen reader's double tap: focus, the caret at the end.
  void _activate() {
    if (!widget.enabled) return;
    final controller = _controller;
    if (!controller.selection.isValid) {
      controller.selection = TextSelection.collapsed(
        offset: controller.text.length,
      );
    }
    _focus.requestFocus();
  }

  void _refresh() => setState(() {});

  @override
  void dispose() {
    _focus.removeListener(_refresh);
    _ownController?.dispose();
    _ownFocus?.dispose();
    _disabledFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final shifa = context.shifa;
    final c = shifa.colors;
    final shapes = shifa.shapes;
    final spacing = shifa.spacing;
    final type = shifa.typography;
    final error = widget.error;
    final focused = _focus.hasFocus;
    final (line, width) = error != null
        ? (shifa.status.danger.fg, shapes.borderFocus)
        : focused
        ? (c.borderFocus, shapes.borderFocus)
        : widget.enabled
        ? (c.inputBorder, shapes.borderDefault)
        : (c.borderDefault, shapes.borderDefault);
    final textStyle = type.paragraphMd.copyWith(
      color: widget.enabled ? c.inputFg : c.textDisabled,
    );

    final editable = EditableText(
      key: editableTextKey,
      controller: _controller,
      // Disabled: a node of our own that never takes focus, so the caller's
      // node is never changed.
      focusNode: widget.enabled ? _focus : _disabledFocus,
      readOnly: !widget.enabled,
      autofocus: widget.autofocus,
      style: textStyle,
      cursorColor: c.borderFocus,
      backgroundCursorColor: c.textMuted,
      selectionColor: c.selectionStrong,
      keyboardType: widget.keyboardType,
      textInputAction: widget.textInputAction,
      inputFormatters: const [ShifaWesternDigitsFormatter()],
      onChanged: widget.onChanged,
      onSubmitted: widget.onSubmitted,
      maxLines: widget.maxLines,
      rendererIgnoresPointer: true,
    );

    final box = AnimatedContainer(
      key: ShifaTextField.boxKey,
      duration: ShifaMotion.duration(context, shifa.motion.fast),
      curve: shifa.motion.standard,
      constraints: BoxConstraints(minHeight: spacing.touchTarget),
      padding: EdgeInsetsDirectional.symmetric(
        horizontal: spacing.space3 - width,
        vertical: spacing.space2,
      ),
      alignment: AlignmentDirectional.centerStart,
      decoration: BoxDecoration(
        color: widget.enabled ? c.inputBg : c.bgSurfaceRaised,
        borderRadius: BorderRadius.circular(shapes.radiusInput),
        border: Border.all(color: line, width: width),
        boxShadow: focused && error == null ? shapes.shadowFocus : null,
      ),
      child: Stack(
        alignment: AlignmentDirectional.centerStart,
        children: [
          if (widget.placeholder case final placeholder?)
            ListenableBuilder(
              listenable: _controller,
              builder: (context, _) => _controller.text.isEmpty
                  ? ExcludeSemantics(
                      child: Text(
                        placeholder,
                        style: textStyle.copyWith(color: c.textMuted),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          _gestures.buildGestureDetector(
            behavior: HitTestBehavior.translucent,
            child: editable,
          ),
        ],
      ),
    );

    final below = error ?? widget.helper;
    return IgnorePointer(
      ignoring: !widget.enabled,
      child: MergeSemantics(
        child: Semantics(
          enabled: widget.enabled,
          onTap: widget.enabled ? _activate : null,
          onFocus: widget.enabled ? _activate : null,
          label: widget.label,
          hint: below,
          validationResult: error != null
              ? SemanticsValidationResult.invalid
              : SemanticsValidationResult.none,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              ExcludeSemantics(
                child: GestureDetector(
                  onTap: _activate,
                  child: Text(
                    widget.label,
                    style: type.labelSm.copyWith(
                      color: widget.enabled ? c.textDefault : c.textDisabled,
                    ),
                  ),
                ),
              ),
              SizedBox(height: spacing.space2),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                excludeFromSemantics: true,
                onTap: _activate,
                child: box,
              ),
              if (below != null) ...[
                SizedBox(height: spacing.space2),
                ExcludeSemantics(
                  child: _Below(text: below, isError: error != null),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Below extends StatelessWidget {
  const new({required this.text, required this.isError});

  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final shifa = context.shifa;
    final color = isError ? shifa.status.danger.fg : shifa.colors.textMuted;
    final words = Text(
      text,
      style: shifa.typography.labelSm.copyWith(
        color: color,
        fontWeight: shifa.typography.paragraphMd.fontWeight,
      ),
    );
    if (!isError) return words;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsetsDirectional.only(top: shifa.spacing.space05),
          child: ShifaGlyph(
            ShifaGlyphs.error,
            size: shifa.spacing.space4,
            color: color,
          ),
        ),
        SizedBox(width: shifa.spacing.space1),
        Expanded(child: words),
      ],
    );
  }
}
