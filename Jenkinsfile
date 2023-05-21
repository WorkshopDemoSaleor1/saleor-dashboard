pipeline{
	agent any 
    triggers {
    pollSCM('* * * * *')
    }
	stages{
		stage('vcs'){
			steps{
				git branch: 'main',
                    url: 'https://github.com/WorkshopDemoSaleor1/saleor-dashboard.git'				
				}			
			}
		
		stage('docker image build'){
			steps{
			    sh 'docker image build -t sashidhar/saleor-dashboard1:Dev-21052322 .'		
			}
		}

        stage('docker image push'){
            steps{
                sh 'docker image push sashidhar/saleor-dashboard1:Dev-21052322 .'
            }
        }
	}

}