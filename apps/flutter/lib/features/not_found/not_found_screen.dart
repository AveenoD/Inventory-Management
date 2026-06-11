import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../widgets/buttons.dart';
import '../../widgets/screen_shell.dart';

class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: 'Page not found',
      subtitle: 'The page you requested does not exist.',
      showBack: true,
      child: PrimaryButton(label: 'Go to Dashboard', onPressed: () => context.go('/')),
    );
  }
}
